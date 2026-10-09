import { NavBar } from "@/components/navBar";
import { Footer } from "@/components/footer";
import { ToastContainer } from "react-toastify";

export default function RootTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavBar />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        style={{ marginTop: "60px" }}
      />
    </>
  );
}
