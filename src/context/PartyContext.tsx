import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Sound } from '../types';
import { SEED } from '../data/seed';
import { supabase, supabaseReady } from '../lib/supabase';
import {
  ClockSample, clockOffset, expectedPosition, hash, isDrifting, isNewer, isValidCode, makeCode, MAX_MEMBERS, MAX_UPLOAD_BYTES, needsUpload, overflowIds,
  normalizeCode, partyFilePath, partyKey, PartySound, PartyState, SIGNED_URL_SECONDS, toPartySound,
} from '../lib/party';
import { usePlayer } from './PlayerContext';
import { useAuth } from './AuthContext';

// Private Supabase Storage bucket for songs shared during a party (see supabase.sql). Only logged-in
// users can upload, each into their own folder; others download through short-lived signed links.
const BUCKET = 'party';
const NAME_KEY = 'soundly.partyName';
const JOIN_TIMEOUT_MS = 5000; // no host showed up by then: wrong code or party over
const DRIFT_CHECK_MS = 2000;
const RESYNC_CLOCK_MS = 30_000;

export type Member = { id: string; name: string; host: boolean; joinedAt: number };
export type PartyPhase = 'idle' | 'connecting' | 'live' | 'ended' | 'error';
type Busy = null | 'uploading' | 'downloading';
// Why the song on this phone could not be sent to the others.
export type ShareBlock = null | 'login' | 'tooBig' | 'failed';

type Msg =
  | { type: 'state'; state: PartyState }
  | { type: 'hello'; from: string }
  | { type: 'ping'; from: string; to: string; id: number; t0: number }
  | { type: 'pong'; to: string; id: number; t0: number; th: number }
  | { type: 'end' };

type Ctx = {
  phase: PartyPhase;
  code: string | null;
  isHost: boolean;
  members: Member[];
  busy: Busy;
  message: string | null; // why the party ended / failed
  shareBlocked: ShareBlock;
  name: string;
  setName: (n: string) => void;
  start: () => void;
  join: (code: string) => void;
  leave: () => void;
};
const noop = () => {};
const PartyCtx = createContext<Ctx>({
  phase: 'idle', code: null, isHost: false, members: [], busy: null, message: null, shareBlocked: null, name: '',
  setName: noop, start: noop, join: noop, leave: noop,
});
export const useParty = () => useContext(PartyCtx);

const myId = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; // one per app run
const extOf = (uri: string) => (uri.match(/\.([a-z0-9]{2,4})(?:\?|$)/i)?.[1] ?? 'mp3').toLowerCase();
// The bucket only accepts audio/* types.
const MIME: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
  flac: 'audio/flac', amr: 'audio/amr', '3gp': 'audio/3gpp', wma: 'audio/x-ms-wma', mid: 'audio/midi', midi: 'audio/midi',
};

export function PartyProvider({ children }: { children: ReactNode }) {
  const player = usePlayer();
  const playerRef = useRef(player);
  playerRef.current = player;
  const { session } = useAuth();
  const userId = useRef<string | null>(null);
  userId.current = session?.user.id ?? null;

  const [phase, setPhase] = useState<PartyPhase>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shareBlocked, setShareBlocked] = useState<ShareBlock>(null);
  const [name, setNameState] = useState('');

  const channel = useRef<RealtimeChannel | null>(null);
  const codeRef = useRef<string | null>(null);
  const hostRef = useRef(false);
  const hostId = useRef<string | null>(null);
  const offset = useRef(0); // party time = Date.now() + offset
  const samples = useRef<ClockSample[]>([]);
  const last = useRef<PartyState | null>(null); // newest change seen in the party
  const urls = useRef<Record<string, string>>({}); // party key -> download link
  const files = useRef<Record<string, Sound>>({}); // party key -> song ready to play on this phone
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const sendSeq = useRef(0); // drops the result of an upload that a newer change overtook
  const uploaded = useRef<string[]>([]); // this phone's files in the bucket, removed when it leaves
  const partyNow = () => Date.now() + offset.current;

  useEffect(() => {
    AsyncStorage.getItem(NAME_KEY).then((v) => { if (v) setNameState(v); }).catch(() => {});
  }, []);
  const displayName = () => name.trim() || session?.user.email?.split('@')[0] || `Guest ${myId.slice(-4).toUpperCase()}`;
  const setName = (n: string) => {
    setNameState(n);
    AsyncStorage.setItem(NAME_KEY, n).catch(() => {});
  };

  const send = (msg: Msg) => {
    channel.current?.send({ type: 'broadcast', event: 'msg', payload: msg }).catch(() => {});
  };

  // ---- this phone's changes -> everyone ----------------------------------------------------
  const announce = async () => {
    const seq = ++sendSeq.current;
    const snap = playerRef.current.snapshot();
    let sound: PartySound | null = null;
    if (snap.sound) {
      sound = toPartySound(snap.sound, urls.current);
      if (!sound && needsUpload(snap.sound)) {
        const url = await upload(snap.sound);
        if (!url || seq !== sendSeq.current) return; // failed, or the user already moved on
        urls.current[partyKey(snap.sound)] = url;
        return announce(); // again, with the position as it is now
      }
      if (!sound) return;
    }
    const state: PartyState = { sound, position: snap.position, at: partyNow(), playing: snap.playing, rate: snap.rate, from: myId };
    last.current = state;
    send({ type: 'state', state });
  };

  const upload = async (s: Sound): Promise<string | null> => {
    if (!codeRef.current) return null;
    const uid = userId.current;
    if (!uid) { setShareBlocked('login'); return null; } // the song still plays here, just not for the others
    setBusy('uploading');
    try {
      const ext = extOf(s.audio_url);
      const path = partyFilePath(uid, codeRef.current, partyKey(s), ext);
      const file = new File(s.audio_url);
      if ((file.size ?? 0) > MAX_UPLOAD_BYTES) { setShareBlocked('tooBig'); return null; } // checked before using any data
      const bytes = await file.bytes();
      const bucket = supabase.storage.from(BUCKET);
      const { error } = await bucket.upload(path, bytes, { contentType: MIME[ext] ?? 'audio/mpeg', upsert: true });
      if (error) throw error;
      uploaded.current.push(path);
      const { data, error: signError } = await bucket.createSignedUrl(path, SIGNED_URL_SECONDS);
      if (signError || !data) throw signError ?? new Error('no signed url');
      setShareBlocked(null);
      return data.signedUrl;
    } catch (e) {
      console.warn('[party] upload failed', e);
      setShareBlocked('failed');
      return null;
    } finally {
      setBusy(null);
    }
  };

  // Take this phone's shared files down (the scheduled cleanup catches whatever a crash leaves).
  const removeUploads = () => {
    const paths = uploaded.current;
    uploaded.current = [];
    if (paths.length) supabase.storage.from(BUCKET).remove(paths).catch(() => {});
  };

  // ---- everyone's changes -> this phone ----------------------------------------------------
  const soundFor = async (ps: PartySound): Promise<Sound | null> => {
    const cur = playerRef.current.snapshot().sound;
    if (cur && partyKey(cur) === ps.key) return cur; // already playing it (the sender, or synced before)
    if (files.current[ps.key]) return files.current[ps.key];
    if (ps.source.kind === 'seed') {
      const seedId = ps.source.id;
      return SEED.find((x) => x.id === seedId) ?? null;
    }
    // Download first and play the local copy: streaming would start at an unknown moment.
    const url = ps.source.url;
    urls.current[ps.key] = url;
    setBusy('downloading');
    try {
      const dir = new Directory(Paths.cache, 'party');
      dir.create({ idempotent: true, intermediates: true });
      const file = new File(dir, `${hash(ps.key)}.${extOf(url)}`);
      if (!file.exists) await File.downloadFileAsync(url, file, { idempotent: true });
      const s: Sound = {
        id: `party:${ps.key}`, party_key: ps.key, title: ps.title, artist: ps.artist, album: ps.album, emoji: ps.emoji,
        category: ps.category, duration: ps.duration, audio_url: file.uri,
      };
      files.current[ps.key] = s;
      return s;
    } catch (e) {
      console.warn('[party] download failed', e);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const apply = async (st: PartyState) => {
    if (!st.sound) {
      playerRef.current.applyRemote({ sound: null, position: 0, playing: false, rate: st.rate });
      return;
    }
    const sound = await soundFor(st.sound);
    const now = last.current;
    if (!sound || !now?.sound || now.sound.key !== st.sound.key) return; // the party moved on meanwhile
    playerRef.current.applyRemote({ sound, position: expectedPosition(now, partyNow()), playing: now.playing, rate: now.rate });
  };

  const onMsg = (msg: Msg) => {
    switch (msg.type) {
      case 'state':
        if (!isNewer(msg.state, last.current)) return;
        last.current = msg.state;
        apply(msg.state);
        return;
      case 'hello': // someone joined: the host catches them up (only if a song is on: an empty party
        // must not stop what the newcomer is listening to)
        if (!hostRef.current) return;
        if (last.current?.sound) send({ type: 'state', state: last.current });
        else if (playerRef.current.snapshot().sound) announce();
        return;
      case 'ping':
        if (msg.to === myId) send({ type: 'pong', to: msg.from, id: msg.id, t0: msg.t0, th: Date.now() });
        return;
      case 'pong':
        if (msg.to !== myId) return;
        samples.current = [...samples.current.slice(-9), { sent: msg.t0, hostTime: msg.th, received: Date.now() }];
        offset.current = clockOffset(samples.current) ?? offset.current;
        return;
      case 'end':
        finish('The host ended the party.');
        return;
    }
  };

  // ~5 quick pings to the host; their round trips give the clock offset.
  const syncClock = () => {
    if (hostRef.current || !hostId.current) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => send({ type: 'ping', from: myId, to: hostId.current!, id: i, t0: Date.now() }), i * 150);
    }
  };

  // ---- connection ----------------------------------------------------------------------------
  const finish = (why: string | null, asError = false) => {
    removeUploads();
    timers.current.forEach(clearInterval);
    timers.current = [];
    const ch = channel.current;
    channel.current = null;
    if (ch) { ch.untrack().catch(() => {}); supabase.removeChannel(ch).catch(() => {}); }
    codeRef.current = null;
    hostRef.current = false;
    hostId.current = null;
    last.current = null;
    samples.current = [];
    offset.current = 0;
    setMembers([]);
    setIsHost(false);
    setCode(null);
    setBusy(null);
    setShareBlocked(null);
    setMessage(why);
    setPhase(why ? (asError ? 'error' : 'ended') : 'idle');
  };

  const connect = (partyCode: string, asHost: boolean) => {
    if (!supabaseReady) { setMessage('Party needs the Supabase connection (set EXPO_PUBLIC_SUPABASE_URL).'); setPhase('error'); return; }
    finish(null);
    codeRef.current = partyCode;
    hostRef.current = asHost;
    if (asHost) hostId.current = myId;
    setCode(partyCode);
    setIsHost(asHost);
    setMessage(null);
    setPhase('connecting');

    const ch = supabase.channel(`party:${partyCode}`, { config: { broadcast: { self: false }, presence: { key: myId } } });
    channel.current = ch;
    let sawHost = asHost;

    ch.on('broadcast', { event: 'msg' }, ({ payload }) => onMsg(payload as Msg));
    ch.on('presence', { event: 'sync' }, () => {
      const list: Member[] = Object.values(ch.presenceState<{ name: string; host: boolean; id: string; joinedAt: number }>())
        .flat()
        .map((p) => ({ id: p.id, name: p.name, host: p.host, joinedAt: p.joinedAt ?? 0 }));
      setMembers(list);
      if (!asHost && overflowIds(list).includes(myId)) {
        finish(`This party is full (${MAX_MEMBERS} phones max).`, true);
        return;
      }
      const host = list.find((m) => m.host);
      if (host && !asHost) {
        const first = !sawHost;
        sawHost = true;
        hostId.current = host.id;
        if (first) {
          setPhase('live');
          syncClock();
          setTimeout(() => send({ type: 'hello', from: myId }), 900); // after the clock has a first estimate
        }
      } else if (!host && sawHost && !asHost) {
        finish('The host left, so the party is over.');
      }
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ id: myId, name: displayName(), host: asHost, joinedAt: Date.now() });
        if (asHost) setPhase('live'); // guests get the song when they say hello
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // offline, or the server is at its limit (the free plan allows a set number of live connections)
        finish('Party is unavailable right now. Check your internet connection, or try again in a few minutes.', true);
      }
    });

    if (!asHost) {
      setTimeout(() => {
        if (channel.current === ch && !sawHost) finish(`No party found with code ${partyCode}.`, true);
      }, JOIN_TIMEOUT_MS);
    }

    timers.current.push(setInterval(syncClock, RESYNC_CLOCK_MS));
    // Keep in line: small drifts add up (different phones, seeks that land late).
    timers.current.push(setInterval(() => {
      const st = last.current;
      const p = playerRef.current;
      const cur = p.snapshot().sound;
      if (!st?.sound || !cur || partyKey(cur) !== st.sound.key) return;
      const expected = expectedPosition(st, partyNow());
      const actual = p.actualPosition();
      const off = st.playing ? actual === null || isDrifting(actual, expected) : p.snapshot().playing;
      if (off) p.applyRemote({ sound: cur, position: expected, playing: st.playing, rate: st.rate });
    }, DRIFT_CHECK_MS));
  };

  // Every change the user makes while in a party goes to the others.
  useEffect(() => player.subscribeControl(() => { if (codeRef.current) announce(); }), []);

  const leave = async () => {
    const wasHost = hostRef.current;
    // let "end" go out before the channel closes
    if (wasHost) await channel.current?.send({ type: 'broadcast', event: 'msg', payload: { type: 'end' } satisfies Msg }).catch(() => {});
    finish(null); // also removes this phone's shared files; every member removes their own
  };

  useEffect(() => () => { if (codeRef.current) leave(); }, []);

  const value = useMemo<Ctx>(() => ({
    phase, code, isHost, members, busy, message, shareBlocked, name,
    setName,
    start: () => connect(makeCode(), true),
    join: (input: string) => {
      const c = normalizeCode(input);
      if (!isValidCode(c)) { setMessage('Codes have 6 letters / numbers.'); setPhase('error'); return; }
      connect(c, false);
    },
    leave,
  }), [phase, code, isHost, members, busy, message, shareBlocked, name]);

  return <PartyCtx.Provider value={value}>{children}</PartyCtx.Provider>;
}
