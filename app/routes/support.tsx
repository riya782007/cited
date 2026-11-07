import type { MetaFunction } from "react-router";
import { PublicLayout, publicStyles as s } from "../components/PublicLayout";

export const meta: MetaFunction = () => [{ title: "Support · Cited by Newvora" }];

export default function Support() {
  return (
    <PublicLayout>
      <h1>Support</h1>
      <p className={s.lead}>Real people at Newvora answer every message.</p>
      <div className={s.cards}>
        <div className={s.card}>
          <h3>Email</h3>
          <p><a href="mailto:support@newvora.in">support@newvora.in</a><br />We aim to reply within one business day (Monday to Saturday, India time).</p>
        </div>
        <div className={s.card}>
          <h3>WhatsApp</h3>
          <p><a href="https://wa.me/918377062790?text=Hi%2C%20I%20need%20help%20with%20Cited">+91 83770 62790</a><br />Good for quick questions.</p>
        </div>
      </div>
      <h2>When you write, please include</h2>
      <ul>
        <li>Your store's myshopify domain</li>
        <li>What you were trying to do, and what happened instead</li>
        <li>A screenshot, if you can</li>
      </ul>
      <p>For setup help and common questions, see the <a href="/docs">docs</a>.</p>
    </PublicLayout>
  );
}
