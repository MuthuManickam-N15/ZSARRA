// A template (unlike a layout) is re-created on every navigation, so each page fades up when you arrive.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
