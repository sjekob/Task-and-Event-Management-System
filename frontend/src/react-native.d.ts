import 'react-native';

// react-native-web reports pointer hover to Pressable's render callbacks;
// the core typings only describe `pressed`.
declare module 'react-native' {
  interface PressableStateCallbackType {
    hovered?: boolean;
  }
}
