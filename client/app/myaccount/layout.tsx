import "../marketing.css";
import "./myaccount.css";
import { AccountSidebar } from "./_sidebar";

export default function MyAccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mkt account">
      <header className="account-hero">
        <div className="account-hero-atmosphere" aria-hidden="true" />
        <div className="mkt-shell account-hero-inner">
          <p className="account-brand mkt-rise">JobGenius</p>
          <h1 className="account-headline mkt-rise mkt-rise-delay">
            Your account, in one place.
          </h1>
          <p className="account-support mkt-rise mkt-rise-delay-2">
            See the details we have on file, jump to history, or open settings
            and billing when you need them.
          </p>
        </div>
      </header>

      <section className="account-stage" aria-label="Account workspace">
        <div className="mkt-shell account-stage-inner">
          <div className="account-layout">
            <AccountSidebar />
            <div className="account-main">{children}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
