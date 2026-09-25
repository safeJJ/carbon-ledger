"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Leaf, LockKeyhole, ShieldCheck } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export function AuthPanel() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) { setError("ยังไม่ได้ตั้งค่า Supabase สำหรับเว็บนี้"); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setMessage("ส่งคำขอยืนยันบัญชีแล้ว กรุณาตรวจอีเมลก่อนเข้าสู่ระบบ");
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "Invalid login credentials"
        ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง"
        : cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่");
    } finally { setBusy(false); }
  }

  return <main className="auth-page">
    <div className="auth-hero"><div className="auth-brand"><span className="mark"><Leaf size={23} /></span><b>Carbon Ledger</b></div><div><span className="auth-overline">CARBON FOOTPRINT OF ORGANIZATION</span><h1>จัดการข้อมูลคาร์บอน<br />ขององค์กรได้อย่างเป็นระบบ</h1><p>เลือกค่า EF บันทึกกิจกรรม และดูผลการปล่อยได้จากพื้นที่ส่วนตัวของคุณ</p></div><div className="auth-points"><span><ShieldCheck size={19} /> ข้อมูลแยกตามบัญชี</span><span><LockKeyhole size={19} /> บันทึกในฐานข้อมูล Supabase</span></div></div>
    <section className="auth-card"><div className="auth-card-head"><span className="auth-overline">ยินดีต้อนรับ</span><h2>{mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชีผู้ใช้"}</h2><p>{mode === "signin" ? "เข้าสู่ระบบเพื่อดูข้อมูลของคุณ" : "สร้างพื้นที่ส่วนตัวสำหรับเริ่มบันทึกข้อมูล"}</p></div>
      <form onSubmit={submit} className="auth-form"><label>อีเมล<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email" required /></label><label>รหัสผ่าน<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 10 : 6} required /></label>{mode === "signup" && <p className="auth-hint">ใช้รหัสผ่านอย่างน้อย 10 ตัวอักษรและเก็บไว้ให้ดี ขณะนี้ยังไม่มีอีเมลสำหรับกู้รหัสผ่าน</p>}{error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-success" role="status">{message}</p>}<button className="btn primary" type="submit" disabled={busy}>{busy ? "กำลังดำเนินการ…" : mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}<ArrowRight size={17} /></button></form>
      <div className="auth-switch">{mode === "signin" ? "ยังไม่มีบัญชี?" : "มีบัญชีแล้ว?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>{mode === "signin" ? "สมัครใช้งาน" : "เข้าสู่ระบบ"}</button></div>
    </section>
  </main>;
}
