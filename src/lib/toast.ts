export type ToastKind = 'ok' | 'err' | 'info';
type L = (t: { id: number; text: string; kind: ToastKind }) => void;
const ls = new Set<L>();
let n = 0;
export const toast = (text: string, kind: ToastKind = 'ok') => ls.forEach((l) => l({ id: ++n, text, kind }));
export const onToast = (l: L) => {
  ls.add(l);
  return () => {
    ls.delete(l);
  };
};
