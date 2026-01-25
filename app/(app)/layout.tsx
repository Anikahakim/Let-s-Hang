import NavBar from "./navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <NavBar />
      <div>{children}</div>
    </div>
  );
}
