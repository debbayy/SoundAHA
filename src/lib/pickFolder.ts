import { Platform } from 'react-native';
import { Directory } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { nameFromUri } from './mp3';

export type PickedFolder = {
  name: string; // the folder's own name
  files: string[]; // URIs of what is directly inside it (sub-folders may be among them)
};

// Lets the user choose a folder on the phone and lists what is inside it. Resolves to null when the
// picker is closed without choosing.
//
// Android uses the Storage Access Framework: the system's own folder picker, which gives the app
// read access to that one folder (and nothing else). Android will refuse the top of the storage and
// the Download folder itself; a folder inside them, such as Music/My Album, works.
export async function pickFolder(): Promise<PickedFolder | null> {
  if (Platform.OS === 'android') {
    const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return null;
    const files = await StorageAccessFramework.readDirectoryAsync(perm.directoryUri);
    return { name: nameFromUri(perm.directoryUri), files };
  }

  try {
    const picked = await Directory.pickDirectoryAsync();
    const dir = new Directory(picked.uri);
    return {
      name: nameFromUri(dir.uri),
      files: dir.list().filter((e) => !(e instanceof Directory)).map((e) => e.uri),
    };
  } catch (e) {
    if (/cancel/i.test(String((e as { message?: string })?.message ?? e))) return null;
    throw e;
  }
}
