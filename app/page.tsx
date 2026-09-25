"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Building2, ChartNoAxesColumn, Check,
  ChevronDown, ChevronRight, CircleHelp, ClipboardList, Database, Download,
  FileText, Info, Leaf, Plus, Save, Search, SlidersHorizontal, Trash2, TriangleAlert,
  Zap,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import factors from "./factors.json";
import { AuthPanel } from "./auth-panel";
import { getSupabase } from "@/lib/supabase";
import { dateMatchesPeriod, periodDateRange } from "@/lib/carbon-period";
import type { User } from "@supabase/supabase-js";

type Factor = (typeof factors)[number];
type Entry = {
  id: string; period: "current" | "base"; scope: number; date: string;
  title: string; quantity: number; unit: string; factor: number;
  factorName: string; factorSource: string; factorRow: string; notes: string;
  scope3Category: string;
};
type Profile = {
  organization?: string; preparer?: string; reportingYear?: string; baseYear?: string;
  output?: string; outputUnit?: string; baseOutput?: string; boundary1?: string;
  boundary2?: string; boundary3?: string; activities?: string; address?: string;
  department?: string; responsibility?: string; activeFactors?: string[];
  onlyActiveFactors?: boolean;
};
type ProfileField = Exclude<keyof Profile, "activeFactors" | "onlyActiveFactors">;
type Significance = Record<string, {
  present?: boolean; magnitude?: boolean; influence?: boolean; risk?: boolean;
  industry?: boolean; outsourcing?: boolean; engagement?: boolean; note?: string;
}>;
type Draft = Omit<Entry, "id" | "quantity" | "factor"> & { quantity: string; factor: string };

const scopes: Record<number, string> = {
  1: "Scope 1 · การปล่อยทางตรง",
  2: "Scope 2 · พลังงานที่ซื้อ",
  3: "Scope 3 · การปล่อยทางอ้อมอื่น",
  4: "รายงานแยก · ชีวภาพ/อื่น ๆ",
};
const categories = [
  "Purchased goods and services", "Capital goods", "Fuel- and energy related activities",
  "Upstream transportation and distribution", "Waste generated in operations", "Business travel",
  "Employee commuting", "Upstream leased assets", "Downstream transportation and distribution",
  "Processing of sold products", "Use of sold products", "End-of-life treatment of sold products",
  "Downstream leased assets", "Franchises", "Investments",
];
const thCategories = [
  "สินค้าและบริการที่ซื้อ", "สินทรัพย์ทุน", "เชื้อเพลิงและพลังงานต้นน้ำ",
  "ขนส่งและกระจายสินค้าต้นน้ำ", "ของเสียจากการดำเนินงาน", "การเดินทางเพื่อธุรกิจ",
  "การเดินทางของพนักงาน", "ทรัพย์สินเช่าต้นน้ำ", "ขนส่งและกระจายสินค้าปลายน้ำ",
  "การแปรรูปผลิตภัณฑ์ที่ขาย", "การใช้ผลิตภัณฑ์ที่ขาย", "การกำจัดผลิตภัณฑ์เมื่อสิ้นอายุ",
  "ทรัพย์สินเช่าปลายน้ำ", "แฟรนไชส์", "การลงทุน",
];
const criteria = [
  ["magnitude", "ปริมาณมาก"], ["influence", "มีโอกาสลด"],
  ["risk", "ความเสี่ยง/โอกาส"], ["industry", "แนวทางอุตสาหกรรม"],
  ["outsourcing", "จ้างภายนอก"], ["engagement", "การมีส่วนร่วมของพนักงาน"],
] as const;
const featuredIds = ["AR5V2-157", "AR5V2-123", "AR5V2-29", "AR5V2-19", "AR5V2-30", "AR5V2-155"];
const fmt = (n: number, d = 2) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
const total = (e: Entry) => e.quantity * e.factor / 1000;
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const freshDraft = (): Draft => ({
  period: "current", scope: 1, date: today(),
  title: "", quantity: "", unit: "", factor: "", factorName: "",
  factorSource: "", factorRow: "", notes: "", scope3Category: "",
});

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(() => !getSupabase());
  const userIdRef = useRef<string | null>(null);
  const recordsRef = useRef<HTMLElement | null>(null);
  const pendingRecordsFocus = useRef(false);
  const [tab, setTab] = useState("overview");
  const [profile, setProfile] = useState<Profile>({});
  const [sig, setSig] = useState<Significance>({});
  const [savedMeta, setSavedMeta] = useState(() => JSON.stringify({ profile: {}, sig: {} }));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Draft>(freshDraft);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedFactor, setSelectedFactor] = useState<Factor | null>(null);
  const [factorQuery, setFactorQuery] = useState("");
  const [factorPickerOpen, setFactorPickerOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customFactor, setCustomFactor] = useState(false);
  const [query, setQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogScope, setCatalogScope] = useState("all");
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    function applyUser(next: User | null) {
      if (next?.id !== userIdRef.current) {
        userIdRef.current = next?.id ?? null;
        setProfile({}); setSig({}); setEntries([]); setLoading(!!next);
        setSavedMeta(JSON.stringify({ profile: {}, sig: {} }));
        pendingRecordsFocus.current = false;
        setForm(freshDraft()); setTab("overview"); setEditId(null); setSelectedFactor(null);
        setFactorQuery(""); setFactorPickerOpen(true); setAdvancedOpen(false); setCustomFactor(false);
        setQuery(""); setPeriodFilter("all"); setScopeFilter("all"); setCategoryFilter("all");
        setMismatchOnly(false); setCatalogQuery(""); setCatalogScope("all");
        setExpandedCategory(null); setConfirmId(null); setNotice(""); setFailure("");
        setSaving(false);
      }
      setUser(next);
      setAuthReady(true);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });
    void supabase.auth.getUser().then(({ data }) => {
      applyUser(data.user ?? null);
    }).catch(() => applyUser(null));
    return () => subscription.unsubscribe();
  }, []);

  async function reload(includeMeta = true) {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    setLoading(true);
    setFailure("");
    try {
      const [p, a] = await Promise.all([
        includeMeta ? supabase.from("profiles").select("payload,significance").eq("user_id", user.id).maybeSingle() : Promise.resolve(null),
        supabase.from("activities").select("id,period,scope,date,title,quantity,unit,factor,factor_name,factor_source,factor_row,notes,scope3_category").eq("user_id", user.id).order("date", { ascending: false }).order("created_at", { ascending: false }),
      ]);
      if (p?.error || a.error) throw new Error(p?.error?.message || a.error?.message || "โหลดข้อมูลไม่สำเร็จ");
      if (userIdRef.current !== user.id) return;
      if (p) {
        const loadedProfile = (p.data?.payload || {}) as Profile;
        const loadedSig = (p.data?.significance || {}) as Significance;
        setProfile(loadedProfile); setSig(loadedSig);
        setSavedMeta(JSON.stringify({ profile: loadedProfile, sig: loadedSig }));
      }
      setEntries((a.data || []).map(row => ({
        id: row.id, period: row.period as Entry["period"], scope: row.scope,
        date: row.date, title: row.title, quantity: Number(row.quantity),
        unit: row.unit, factor: Number(row.factor), factorName: row.factor_name,
        factorSource: row.factor_source, factorRow: row.factor_row || "", notes: row.notes || "",
        scope3Category: row.scope3_category || "",
      })));
    } catch (error) {
      if (userIdRef.current === user.id) setFailure(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally { if (userIdRef.current === user.id) setLoading(false); }
  }
  useEffect(() => {
    if (!user?.id) return;
    const task = setTimeout(() => { void reload(); }, 0);
    return () => clearTimeout(task);
    // reload uses the current user after an auth change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  useEffect(() => {
    if (tab !== "activities" || loading || !pendingRecordsFocus.current) return;
    pendingRecordsFocus.current = false;
    const frame = window.requestAnimationFrame(() => recordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [tab, loading, periodFilter, scopeFilter, categoryFilter, mismatchOnly]);

  const totals = useMemo(() => {
    const values = { current: [0, 0, 0, 0, 0], base: [0, 0, 0, 0, 0] };
    for (const item of entries) values[item.period][item.scope] += total(item);
    return values;
  }, [entries]);
  const current = totals.current[1] + totals.current[2] + totals.current[3];
  const base = totals.base[1] + totals.base[2] + totals.base[3];
  const reportCount = entries.filter(e => e.period === "current").length;
  const baseCount = entries.filter(e => e.period === "base").length;
  const savedProfile = useMemo(() => (JSON.parse(savedMeta) as { profile: Profile }).profile, [savedMeta]);
  const savedFactors = savedProfile.activeFactors || [];
  const factorSelectionDirty = JSON.stringify(profile.activeFactors) !== JSON.stringify(savedProfile.activeFactors);
  const setup = [!!profile.organization && !!profile.reportingYear, savedFactors.length > 0, entries.length > 0];
  const completed = setup.filter(Boolean).length;
  const metaDirty = !loading && JSON.stringify({ profile, sig }) !== savedMeta;
  const organizationSummary = ([
    ["ผู้จัดทำ", profile.preparer], ["สถานที่ติดต่อ", profile.address],
    ["กิจกรรมและพื้นที่", profile.activities], ["หน่วยงานที่เกี่ยวข้อง", profile.department],
    ["ผู้รวบรวมและอนุมัติ", profile.responsibility],
    ["แหล่งปล่อย Scope 1", profile.boundary1], ["แหล่งปล่อย Scope 2", profile.boundary2],
    ["แหล่งปล่อย Scope 3", profile.boundary3],
  ] as [string, string | undefined][]).filter(([, value]) => !!value?.trim());
  const filteredEntries = entries.filter(e =>
    (periodFilter === "all" || e.period === periodFilter) &&
    (scopeFilter === "all" || String(e.scope) === scopeFilter) &&
    (categoryFilter === "all" || e.scope3Category === categoryFilter) &&
    (!mismatchOnly || !dateMatchesPeriod(e.date, e.period === "base" ? profile.baseYear || "" : profile.reportingYear || "")) &&
    (!query || [e.title, e.factorName, e.notes].join(" ").toLowerCase().includes(query.toLowerCase()))
  );
  const allowed = factors.filter(f => savedFactors.includes(f.id));
  const scopeFactors = allowed.filter(f => f.defaultScope === Number(form.scope));
  const factorMatches = factorQuery.trim()
    ? scopeFactors.filter(f => `${f.name} ${f.original} ${f.unit}`.toLowerCase().includes(factorQuery.trim().toLowerCase())).slice(0, 8)
    : [...scopeFactors].sort((a, b) => featuredIds.indexOf(a.id) === -1 ? 1 : featuredIds.indexOf(b.id) === -1 ? -1 : featuredIds.indexOf(a.id) - featuredIds.indexOf(b.id)).slice(0, 6);
  const catalogMatches = factors.filter(f => (catalogScope === "all" || f.defaultScope === Number(catalogScope)) && `${f.name} ${f.original} ${f.unit}`.toLowerCase().includes(catalogQuery.toLowerCase()));
  const categoryCounts = Object.fromEntries(categories.map(cat => [cat, entries.filter(e => e.scope === 3 && e.scope3Category === cat).length]));
  const chosenCategories = categories.filter(c => sig[c]?.present || categoryCounts[c] > 0).length;
  const periodMismatches = entries.filter(e => !dateMatchesPeriod(e.date, e.period === "base" ? profile.baseYear || "" : profile.reportingYear || ""));
  const activePeriodLabel = form.period === "base" ? profile.baseYear || "" : profile.reportingYear || "";
  const activePeriodRange = periodDateRange(activePeriodLabel);
  const dateMismatch = !!form.date && !!activePeriodRange && !dateMatchesPeriod(form.date, activePeriodLabel);

  async function saveMeta() {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    setSaving(true); setFailure(""); setNotice("");
    try {
      if (JSON.stringify(profile).length > 15000 || JSON.stringify(sig).length > 15000) throw new Error("ข้อมูลยาวเกินไป");
      const { error } = await supabase.from("profiles").upsert({
        user_id: user.id, payload: profile, significance: sig, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      if (userIdRef.current !== user.id) return;
      setSavedMeta(JSON.stringify({ profile, sig }));
      setNotice("บันทึกข้อมูลเรียบร้อย");
    } catch (error) { if (userIdRef.current === user.id) setFailure(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); }
    finally { if (userIdRef.current === user.id) setSaving(false); }
  }
  async function chooseCatalogFactor(f: Factor) {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    setSaving(true); setFailure(""); setNotice("");
    try {
      const nextProfile = { ...profile, activeFactors: [...new Set([...(profile.activeFactors || []), f.id])] };
      const { error } = await supabase.from("profiles").upsert({
        user_id: user.id, payload: nextProfile, significance: sig, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      if (userIdRef.current !== user.id) return;
      setProfile(nextProfile);
      setSavedMeta(JSON.stringify({ profile: nextProfile, sig }));
      setNotice("บันทึกค่า EF ที่บริษัทเลือกใช้แล้ว");
      selectFactor(f); go("activities", true);
    } catch (error) {
      if (userIdRef.current === user.id) setFailure(error instanceof Error ? error.message : "เลือกค่า EF ไม่สำเร็จ");
    } finally { if (userIdRef.current === user.id) setSaving(false); }
  }
  function selectFactor(f: Factor) {
    const previousFactorName = selectedFactor?.name;
    setSelectedFactor(f); setCustomFactor(false); setFactorPickerOpen(false); setAdvancedOpen(false);
    setFactorQuery("");
    setForm(v => ({ ...v, scope: f.defaultScope, scope3Category: f.defaultScope === 3 ? v.scope3Category : "",
      title: !v.title || v.title === previousFactorName ? f.name : v.title,
      unit: f.unit, factor: String(f.factor), factorName: f.name,
      factorSource: f.source, factorRow: `EF TGO AR5 V2!J${f.row}` }));
  }
  function changeScope(scope: number) {
    const oldFactorName = selectedFactor?.name;
    setForm(v => ({ ...v, scope, scope3Category: scope === 3 ? v.scope3Category : "",
      title: v.title === oldFactorName ? "" : v.title,
      unit: "", factor: "", factorName: "", factorSource: "", factorRow: "" }));
    setSelectedFactor(null); setCustomFactor(false); setFactorPickerOpen(true);
    setFactorQuery(""); setAdvancedOpen(false);
  }
  function useCustomFactor() {
    setSelectedFactor(null); setCustomFactor(true); setFactorPickerOpen(false); setAdvancedOpen(true);
    setForm(v => ({ ...v, factor: "", factorName: "", factorSource: "", factorRow: "", unit: "" }));
  }
  function resetDraft() {
    setForm(freshDraft()); setEditId(null); setSelectedFactor(null);
    setCustomFactor(false); setFactorPickerOpen(true); setAdvancedOpen(false); setFactorQuery("");
  }
  async function saveEntry(event: React.FormEvent) {
    event.preventDefault(); setFailure(""); setNotice("");
    const supabase = getSupabase();
    if (!supabase || !user) return;
    if (!form.factorName || !form.factorSource || !form.unit || form.factor === "") {
      setFailure("เลือกค่า EF จากรายการ หรือกรอกข้อมูลปัจจัยการปล่อยให้ครบ"); return;
    }
    if (dateMismatch) {
      setFailure("วันที่ไม่อยู่ในช่วงปีที่เลือก กรุณาตรวจช่วงข้อมูลหรือวันที่อีกครั้ง"); return;
    }
    if (Number(form.scope) === 3 && !categories.includes(form.scope3Category)) {
      setFailure("กรุณาเลือกหมวด Scope 3 ให้รายการนี้"); return;
    }
    if (form.factorRow && !factors.some(f => f.defaultScope === Number(form.scope) && form.factorRow === `EF TGO AR5 V2!J${f.row}` && Number(form.factor) === f.factor && form.unit === f.unit)) {
      setFailure("ค่า EF จาก TGO ไม่ตรงกับ Scope หน่วย หรือค่าปัจจัย กรุณาเลือกค่าใหม่"); return;
    }
    if (!Number.isFinite(Number(form.quantity)) || Number(form.quantity) <= 0 || !Number.isFinite(Number(form.factor)) || Number(form.factor) < 0 || Number(form.quantity) > 1e12 || Number(form.factor) > 1e9) {
      setFailure("ปริมาณต้องมากกว่า 0 และค่า EF ต้องไม่ติดลบ"); return;
    }
    setSaving(true);
    try {
      const record = { period: form.period, scope: Number(form.scope), date: form.date,
        scope3_category: Number(form.scope) === 3 ? form.scope3Category : null,
        title: form.title.trim(), quantity: Number(form.quantity), unit: form.unit.trim(),
        factor: Number(form.factor), factor_name: form.factorName.trim(),
        factor_source: form.factorSource.trim(), factor_row: form.factorRow || "", notes: form.notes || "" };
      const result = editId
        ? await supabase.from("activities").update(record).eq("id", editId).eq("user_id", user.id).select("id").single()
        : await supabase.from("activities").insert({ ...record, id: crypto.randomUUID(), user_id: user.id }).select("id").single();
      if (result.error) throw result.error;
      if (userIdRef.current !== user.id) return;
      resetDraft(); setNotice(editId ? "แก้ไขรายการเรียบร้อย" : "บันทึกรายการเรียบร้อย");
      await reload(false);
    } catch (error) { if (userIdRef.current === user.id) setFailure(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); }
    finally { if (userIdRef.current === user.id) setSaving(false); }
  }
  function startEdit(e: Entry) {
    setForm({ period: e.period, scope: e.scope, date: e.date, title: e.title,
      quantity: String(e.quantity), unit: e.unit, factor: String(e.factor),
      factorName: e.factorName, factorSource: e.factorSource, factorRow: e.factorRow || "", notes: e.notes || "",
      scope3Category: e.scope3Category });
    const matched = factors.find(f => e.factorRow === `EF TGO AR5 V2!J${f.row}`) || null;
    setSelectedFactor(matched); setCustomFactor(!matched); setFactorPickerOpen(false); setAdvancedOpen(!matched);
    setEditId(e.id); setTab("activities"); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function remove(id: string) {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    setSaving(true); setFailure("");
    try {
      const { error } = await supabase.from("activities").delete().eq("id", id).eq("user_id", user.id).select("id").single();
      if (error) throw error;
      if (userIdRef.current !== user.id) return;
      setConfirmId(null); setNotice("ลบรายการเรียบร้อย"); await reload(false);
    } catch (error) { if (userIdRef.current === user.id) setFailure(error instanceof Error ? error.message : "ลบไม่สำเร็จ"); }
    finally { if (userIdRef.current === user.id) setSaving(false); }
  }
  function exportCSV() {
    setFailure(""); setNotice("");
    try {
      const head = ["ปี", "วันที่", "ขอบเขต", "หมวด Scope 3", "รายการ", "ปริมาณ", "หน่วย", "ค่า EF (kgCO2e/หน่วย)", "การปล่อย (tCO2e)", "ชื่อปัจจัย", "แหล่งอ้างอิง", "แถวในไฟล์", "หมายเหตุ"];
      const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
      const rows = [head, ...entries.map(e => [e.period === "base" ? profile.baseYear || "ปีฐาน" : profile.reportingYear || "ปีรายงาน", e.date, e.scope, thCategories[categories.indexOf(e.scope3Category)] || "", e.title, e.quantity, e.unit, e.factor, total(e), e.factorName, e.factorSource, e.factorRow, e.notes])];
      const blob = new Blob(["\uFEFF" + rows.map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = "carbon-inventory.csv"; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`เริ่มดาวน์โหลด carbon-inventory.csv (${entries.length} รายการ)`);
    } catch (error) { setFailure(error instanceof Error ? error.message : "ส่งออก CSV ไม่สำเร็จ"); }
  }
  async function signOut() {
    setFailure(""); setNotice("");
    try {
      const { error } = await getSupabase()!.auth.signOut();
      if (error) throw error;
    } catch (error) { setFailure(`ออกจากระบบไม่สำเร็จ: ${error instanceof Error ? error.message : "กรุณาลองใหม่"}`); }
  }
  function toggleCatalogFactor(f: Factor, checked: boolean) {
    setProfile(p => {
      const activeFactors = checked ? [...new Set([...(p.activeFactors || []), f.id])] : (p.activeFactors || []).filter(id => id !== f.id);
      const next: Profile = { ...p, activeFactors };
      if (!activeFactors.length && savedProfile.activeFactors === undefined) delete next.activeFactors;
      return next;
    });
    if (!checked && !editId && selectedFactor?.id === f.id) {
      setSelectedFactor(null); setFactorPickerOpen(true);
      setForm(v => ({ ...v, title: v.title === f.name ? "" : v.title,
        unit: "", factor: "", factorName: "", factorSource: "", factorRow: "" }));
    }
  }
  const field = (key: ProfileField, label: string, placeholder = "", type = "text") =>
    <label className="field" key={key}><span>{label}</span><input type={type} min={type === "number" ? "0" : undefined}
      value={profile[key] || ""} placeholder={placeholder}
      onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} /></label>;
  const go = (value: string, keepFactorChanges = false) => {
    if (tab === "factors" && value !== "factors" && !keepFactorChanges && !saving && factorSelectionDirty) {
      setProfile(p => {
        const next = { ...p };
        if (savedProfile.activeFactors === undefined) delete next.activeFactors;
        else next.activeFactors = [...savedFactors];
        return next;
      });
    }
    setTab(value); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openEntries = (scope = "all", period = "all", category = "all", onlyMismatches = false) => {
    pendingRecordsFocus.current = true;
    setScopeFilter(scope); setPeriodFilter(period); setCategoryFilter(category);
    setMismatchOnly(onlyMismatches); setQuery(""); setTab("activities");
  };
  const addScopedEntry = (scope: number, category = "") => {
    resetDraft();
    setForm(v => ({ ...v, scope, scope3Category: category }));
    go("activities");
  };

  if (!authReady) return <main className="auth-loading">กำลังตรวจสอบบัญชี…</main>;
  if (!getSupabase()) return <main className="auth-loading">ยังไม่ได้ตั้งค่า Supabase สำหรับเว็บนี้</main>;
  if (!user) return <AuthPanel />;

  return <main className="site">
    <aside className="rail">
      <div className="brand"><span className="mark"><Leaf size={21} /></span><span><strong>Carbon Ledger</strong><small>บัญชีคาร์บอนองค์กร</small></span></div>
      <div className="rail-section-label">ขั้นตอนการทำงาน</div>
      <div className="rail-steps">
        <button className={tab === "organization" ? "is-active" : undefined} aria-current={tab === "organization" ? "page" : undefined} onClick={() => go("organization")}><span className={setup[0] ? "step-done" : "step-number"}>{setup[0] ? <Check size={15} /> : "01"}</span><span>ข้อมูลองค์กร<small>ระบุชื่อและปีรายงาน</small></span></button>
        <button className={tab === "factors" ? "is-active" : undefined} aria-current={tab === "factors" ? "page" : undefined} onClick={() => go("factors")}><span className={setup[1] ? "step-done" : "step-number"}>{setup[1] ? <Check size={15} /> : "02"}</span><span>ค่า EF ที่ใช้<small>เลือกปัจจัยของบริษัท</small></span></button>
        <button className={tab === "activities" ? "is-active" : undefined} aria-current={tab === "activities" ? "page" : undefined} onClick={() => go("activities")}><span className={setup[2] ? "step-done" : "step-number"}>{setup[2] ? <Check size={15} /> : "03"}</span><span>บันทึกกิจกรรม<small>กรอกปริมาณจริง</small></span></button>
      </div>
      <div className="rail-progress"><div><span>ความพร้อมของข้อมูล</span><strong>{completed}/3</strong></div><div className="progress-track"><span style={{ width: `${completed / 3 * 100}%` }} /></div></div>
      <div className="rail-bottom"><span className="source-dot" /> ข้อมูลส่วนตัวของบัญชีนี้</div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="crumb"><span>บัญชีคาร์บอน</span><ChevronRight size={15} /><b>{profile.organization || "องค์กรของคุณ"}</b></div><div className="account-actions"><span className="privacy"><span className="source-dot" /> {user.email}</span><button className="signout" onClick={() => void signOut()}>ออกจากระบบ</button></div></header>
      <Tabs value={tab} onValueChange={go} className="main-tabs">
        <div className="page-head"><div><div className="eyebrow">CARBON FOOTPRINT OF ORGANIZATION</div><h1>{tab === "overview" ? "ภาพรวมการปล่อยก๊าซเรือนกระจก" : tab === "activities" ? "บันทึกกิจกรรม" : tab === "organization" ? "ข้อมูลองค์กร" : tab === "significance" ? "ประเมิน Scope 3" : "คลังค่า EF"}</h1><p>{profile.organization || "ตั้งค่าข้อมูลองค์กรเพื่อเริ่มจัดทำบัญชีการปล่อย"}{profile.reportingYear ? ` · ${profile.reportingYear}` : ""}</p></div><div className="head-actions"><button className="btn ghost export-button" onClick={exportCSV} disabled={!entries.length}><Download size={17} /> ส่งออก CSV</button><button className="btn primary" onClick={() => { resetDraft(); go("activities"); }}><Plus size={18} /> เพิ่มรายการ</button></div></div>
        <TabsList className="navigation" aria-label="หน้าของแบบฟอร์ม">
          <TabsTrigger value="overview"><ChartNoAxesColumn size={17} /> ภาพรวม</TabsTrigger>
          <TabsTrigger value="activities"><ClipboardList size={17} /> รายการคำนวณ</TabsTrigger>
          <TabsTrigger value="organization"><Building2 size={17} /> ข้อมูลองค์กร</TabsTrigger>
          <TabsTrigger value="significance"><Leaf size={17} /> Scope 3</TabsTrigger>
          <TabsTrigger value="factors"><Database size={17} /> ค่า EF</TabsTrigger>
        </TabsList>
        {failure && <div className="message error" role="alert"><TriangleAlert size={18} /><span>{failure}</span><button onClick={() => setFailure("")}>ปิด</button></div>}
        {notice && (!metaDirty || !["บันทึกข้อมูลเรียบร้อย", "บันทึกค่า EF ที่บริษัทเลือกใช้แล้ว"].includes(notice)) && <div className="message success" role="status"><Check size={18} /><span>{notice}</span><button onClick={() => setNotice("")}>ปิด</button></div>}
        {metaDirty && <div className="message pending" role="status"><Info size={18} /><span>มีการเปลี่ยนแปลงที่ยังไม่บันทึกในข้อมูลองค์กร, Scope 3 หรือค่า EF</span><button disabled={saving} onClick={() => void saveMeta()}>{saving ? "กำลังบันทึก…" : "บันทึกตอนนี้"}</button></div>}
        {loading ? <div className="panel loading">กำลังโหลดข้อมูล…</div> : <>
          <TabsContent value="overview" className="tab-content">
            {periodMismatches.length > 0 && <div className="message error" role="status"><TriangleAlert size={18} /><span>พบ {periodMismatches.length} รายการที่วันที่ไม่ตรงกับช่วงปีรายงาน/ปีฐาน กรุณาตรวจสอบก่อนใช้ผลสรุป</span><button onClick={() => openEntries("all", "all", "all", true)}>ตรวจรายการ</button></div>}
            {completed < 3 && <section className="getting-started"><div className="getting-copy"><span className="section-kicker">เริ่มต้นใช้งาน</span><h2>จัดทำข้อมูลเป็น 3 ขั้นตอน</h2><p>ตั้งค่าพื้นฐาน เลือกปัจจัยที่ใช้ แล้วบันทึกปริมาณกิจกรรมจริง</p></div><div className="getting-actions">
              {!setup[0] ? <button className="btn primary" onClick={() => go("organization")}>กรอกข้อมูลองค์กร <ArrowRight size={17} /></button> : !setup[1] ? <button className="btn primary" onClick={() => go("factors")}>เลือกค่า EF <ArrowRight size={17} /></button> : <button className="btn primary" onClick={() => go("activities")}>เพิ่มรายการแรก <ArrowRight size={17} /></button>}
              <span>{completed} จาก 3 ขั้นตอน</span>
            </div></section>}
            <div className="section-line"><div><span className="section-kicker">FR-05 · ปีรายงาน</span><h2>ผลการปล่อยขององค์กร</h2><p>{profile.reportingYear || "ยังไม่กำหนดช่วงปีรายงาน"} · หน่วย tCO₂e</p></div><span className="year-chip">{reportCount} รายการปีรายงาน</span></div>
            <div className="metric-grid"><div className="metric main-metric"><div className="metric-top"><span>รวม Scope 1–3</span><span className="metric-icon"><Leaf size={19} /></span></div><strong>{fmt(current, 3)}</strong><small>ตันคาร์บอนไดออกไซด์เทียบเท่า</small></div>
              {[1, 2, 3].map(i => <div className="metric" key={i}><span className={`scope-indicator s${i}`} /><span>Scope {i}</span><strong>{fmt(totals.current[i], 3)}</strong><small>{i === 1 ? "การปล่อยทางตรง" : i === 2 ? "พลังงานที่ซื้อ" : "การปล่อยทางอ้อมอื่น"}</small><button className="text-button metric-link" onClick={() => openEntries(String(i), "current")}>ดูรายการ <ArrowRight size={14} /></button></div>)}
            </div>
            <div className="dashboard-grid">
              <section className="panel proportions"><div className="panel-head"><div><h3>สัดส่วนการปล่อย</h3><p>เปรียบเทียบแต่ละ Scope ของปีรายงาน</p></div><span className="panel-tag">Scope 1–3</span></div>
                {reportCount ? <div className="bars">{[1, 2, 3].map(i => <div className="bar-row" key={i}><div className="bar-caption"><span><span className={`legend-dot s${i}`} /> Scope {i}</span><b>{fmt(totals.current[i], 3)} <small>tCO₂e</small></b></div><div className="bar-track"><div className={`bar-fill s${i}`} style={{ width: `${current ? totals.current[i] / current * 100 : 0}%` }} /></div><small>{current ? fmt(totals.current[i] / current * 100, 1) : "0.0"}% ของทั้งหมด</small></div>)}</div> : <div className="empty"><span className="empty-icon"><ChartNoAxesColumn size={23} /></span><strong>ยังไม่มีรายการในปีรายงาน</strong><p>เพิ่มปริมาณเชื้อเพลิง ไฟฟ้า หรือกิจกรรมที่องค์กรมี</p><button className="btn secondary" onClick={() => go("activities")}>เริ่มบันทึก <ArrowRight size={16} /></button></div>}
              </section>
              <section className="panel recent"><div className="panel-head"><div><h3>รายการล่าสุด</h3><p>ข้อมูลกิจกรรมที่บันทึกแล้ว</p></div><button className="text-button" onClick={() => openEntries()}>ดูทั้งหมด <ChevronRight size={16} /></button></div>
                {entries.length ? <div className="recent-list">{entries.slice(0, 4).map(e => <div className="recent-row" key={e.id}><div className={`recent-icon s${e.scope}`}><Activity size={17} /></div><div><strong>{e.title}</strong><span>{e.period === "base" ? "ปีฐาน" : "ปีรายงาน"} · Scope {e.scope === 4 ? "แยก" : e.scope} · {e.date}</span></div><b>{fmt(total(e), 3)}</b></div>)}</div> : <div className="empty"><span className="empty-icon"><FileText size={23} /></span><strong>ยังไม่มีรายการที่บันทึก</strong><p>รายการที่เพิ่มจะปรากฏที่นี่และรวมในผลคำนวณ</p></div>}
              </section>
            </div>
            <div className="dashboard-lower">
              <section className="panel compare-panel"><div className="panel-head"><div><h3>เปรียบเทียบกับปีฐาน</h3><p>{profile.baseYear || "ยังไม่กำหนดปีฐาน"}</p></div>{baseCount > 0 && <span className="panel-tag">{baseCount} รายการปีฐาน</span>}</div><div className="compare"><div><span>ปีรายงาน</span><strong>{fmt(current, 3)}</strong><small>tCO₂e</small></div><div><span>ปีฐาน</span><strong>{fmt(base, 3)}</strong><small>tCO₂e</small></div></div>{base > 0 ? <div className={`delta ${current <= base ? "down" : "up"}`}>{current <= base ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}{current <= base ? "ลดลง" : "เพิ่มขึ้น"} {fmt(Math.abs(current - base) / base * 100, 1)}% จากปีฐาน</div> : <p className="hint">เพิ่มข้อมูลกิจกรรมของปีฐานเพื่อดูการเปลี่ยนแปลง</p>}<button className="text-button panel-link" onClick={() => openEntries("all", "base")}>ดูรายการปีฐาน <ArrowRight size={14} /></button></section>
              <section className="panel intensity-panel"><div className="panel-head"><div><h3>ความเข้มการปล่อย</h3><p>ผลการปล่อย ÷ ผลผลิตของแต่ละปี</p></div><span className="panel-tag">tCO₂e / {profile.outputUnit || "หน่วย"}</span></div><div className="intensity"><span>Scope 1 + 2 · ปีรายงาน</span><strong>{Number(profile.output) > 0 ? fmt((totals.current[1] + totals.current[2]) / Number(profile.output), 4) : "—"}</strong></div><div className="intensity"><span>Scope 1 + 2 + 3 · ปีรายงาน</span><strong>{Number(profile.output) > 0 ? fmt(current / Number(profile.output), 4) : "—"}</strong></div>{baseCount > 0 && <div className="intensity"><span>Scope 1 + 2 + 3 · ปีฐาน</span><strong>{Number(profile.baseOutput) > 0 ? fmt(base / Number(profile.baseOutput), 4) : "—"}</strong></div>}{(!Number(profile.output) || (baseCount > 0 && !Number(profile.baseOutput))) && <button className="text-button" onClick={() => go("organization")}>ระบุผลผลิตเพื่อคำนวณ <ArrowRight size={15} /></button>}</section>
              <section className="panel separate-panel"><div className="panel-head"><div><h3>การปล่อยที่รายงานแยก</h3><p>เช่น CO₂ จากเชื้อเพลิงชีวภาพ</p></div></div><div className="other-number">{fmt(totals.current[4], 3)} <small>tCO₂e</small></div><p className="hint">ไม่รวมในยอด Scope 1–3</p><button className="text-button panel-link" onClick={() => openEntries("4", "current")}>ดูรายการ <ArrowRight size={14} /></button></section>
            </div>
            <section className="panel organization-summary"><div className="panel-head"><div><h3>ข้อมูลประกอบรายงาน</h3><p>{profile.organization || "ยังไม่ระบุชื่อองค์กร"} · {organizationSummary.length} หัวข้อที่กรอกแล้ว</p></div><button className="text-button" onClick={() => go("organization")}>แก้ไขข้อมูลองค์กร <ArrowRight size={15} /></button></div>
              {organizationSummary.length ? <div className="summary-grid">{organizationSummary.map(([label, value]) => <div className="summary-item" key={label}><small>{label}</small><span>{value}</span></div>)}</div> : <p className="hint">ระบุผู้จัดทำ ขอบเขตแหล่งปล่อย และผู้รับผิดชอบในหน้าข้อมูลองค์กร</p>}
            </section>
          </TabsContent>
          <TabsContent value="activities" className="tab-content">
            <div className="section-line"><div><span className="section-kicker">FR-04.1 / FR-04.2</span><h2>เพิ่มกิจกรรมและดูผลคำนวณ</h2><p>เลือกปัจจัยที่ตรงกับกิจกรรม ใส่ปริมาณ แล้วบันทึก</p></div><span className="year-chip">{entries.length} รายการทั้งหมด</span></div>
            <div className="entry-layout">
              <section className="panel entry-form"><div className="form-heading"><div><span className="section-kicker">{editId ? "แก้ไขข้อมูล" : "รายการใหม่"}</span><h3>{editId ? "แก้ไขรายการกิจกรรม" : "บันทึกกิจกรรม"}</h3></div>{editId && <button className="text-button" onClick={resetDraft}>ยกเลิกแก้ไข</button>}</div>
                <form onSubmit={saveEntry}>
                  <div className="form-section"><div className="step-heading"><span>1</span><div><strong>ข้อมูลกิจกรรม</strong><small>รายการนี้เกิดขึ้นเมื่อไรและอยู่ในขอบเขตใด</small></div></div>
                    <div className="form-grid form-grid-three"><label className="field"><span>ช่วงข้อมูล</span><NativeSelect value={form.period} onChange={e => setForm(v => ({ ...v, period: e.target.value as Draft["period"] }))}><option value="current">ปีรายงาน {profile.reportingYear || ""}</option><option value="base">ปีฐาน {profile.baseYear || ""}</option></NativeSelect></label>
                      <label className="field"><span>วันที่</span><input type="date" required value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} /></label>
                      <label className="field"><span>ขอบเขต</span><NativeSelect value={form.scope} onChange={e => changeScope(Number(e.target.value))}>{Object.entries(scopes).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</NativeSelect></label></div>
                    {dateMismatch && <p className="form-warning" role="alert">วันที่ {form.date} ไม่อยู่ในช่วง {activePeriodLabel} กรุณาตรวจช่วงข้อมูลหรือวันที่</p>}
                    {Number(form.scope) === 3 && <div className="form-grid"><label className="field"><span>หมวด Scope 3</span><NativeSelect required value={form.scope3Category} onChange={e => setForm(v => ({ ...v, scope3Category: e.target.value }))}><option value="">เลือกหมวดกิจกรรมทางอ้อม</option>{categories.map((cat, i) => <option value={cat} key={cat}>{thCategories[i]}{sig[cat]?.present || categoryCounts[cat] > 0 ? " · ประเมินแล้ว" : ""}</option>)}</NativeSelect></label><div className="field field-help"><span>เชื่อมกับผลประเมิน</span><button type="button" className="text-button" onClick={() => go("significance")}>ดูหมวด Scope 3 <ArrowRight size={14} /></button></div></div>}
                  </div>
                  <div className="form-section"><div className="step-heading"><span>2</span><div><strong>เลือกแหล่งปล่อย / ค่า EF</strong><small>เลือกจากไฟล์อ้างอิง หรือกรอกปัจจัยที่มีเอง</small></div></div>
                    {selectedFactor && !factorPickerOpen && <div className="selected-factor"><div className="selected-icon"><Zap size={20} /></div><div><span>ค่า EF ที่เลือก</span><strong>{selectedFactor.name}</strong><small>{fmt(selectedFactor.factor, 6)} kgCO₂e/{selectedFactor.unit} · EF TGO AR5 V2 แถว {selectedFactor.row}</small></div><button type="button" onClick={() => setFactorPickerOpen(true)}>เปลี่ยน</button></div>}
                    {customFactor && !factorPickerOpen && <div className="selected-factor custom-selected"><div className="selected-icon"><SlidersHorizontal size={20} /></div><div><span>ค่า EF จากแหล่งของคุณ</span><strong>{form.factorName || "กรอกข้อมูลปัจจัยด้านล่าง"}</strong></div><button type="button" onClick={() => setFactorPickerOpen(true)}>เปลี่ยน</button></div>}
                    {factorPickerOpen && <div className="factor-chooser"><p className="factor-scope-note">แสดงค่า EF จากชุดข้อมูล TGO เฉพาะ {scopes[Number(form.scope)]} · {scopeFactors.length} รายการ</p><div className="search-box"><Search size={17} /><input aria-label="ค้นหาค่า EF สำหรับกิจกรรม" placeholder="ค้นหาค่า EF ใน Scope นี้" value={factorQuery} onChange={e => setFactorQuery(e.target.value)} /></div>
                      <div className="factor-suggestions">{factorMatches.map(f => <button className="factor-option" type="button" key={f.id} onClick={() => selectFactor(f)}><span className="factor-option-icon"><Zap size={16} /></span><span><strong>{f.name}</strong><small>{f.defaultScope === 4 ? "รายงานแยก" : `Scope ${f.defaultScope}`} · แถว {f.row}</small></span><b>{fmt(f.factor, 5)} <small>/{f.unit}</small></b></button>)}
                        {!factorMatches.length && <div className="factor-empty"><strong>{!savedFactors.length ? "ยังไม่ได้บันทึกค่า EF ที่บริษัทใช้" : !scopeFactors.length ? "ยังไม่ได้บันทึกค่า EF สำหรับ Scope นี้" : "ไม่พบค่า EF ที่ค้นหาใน Scope นี้"}</strong><p>เลือกปัจจัยจากคลังค่า EF แล้วบันทึกการตั้งค่า รายการจึงจะปรากฏที่นี่</p><button type="button" onClick={() => { setCatalogScope(String(form.scope)); go("factors"); }}>ไปเลือกค่า EF <ArrowRight size={14} /></button></div>}
                      </div><div className="factor-chooser-footer"><span>{Number(form.scope) === 3 ? "TGO ชุดนี้มีค่า Scope 3 จำกัด · ใช้ EF จากแหล่งอื่นพร้อมอ้างอิงได้" : factorQuery ? "เลือกแถวให้ตรงกับชนิดกิจกรรม" : "รายการที่ใช้บ่อย · ค้นหาชื่อเพื่อดูค่าอื่น"}</span><button type="button" onClick={useCustomFactor}>กรอก EF เอง <ArrowRight size={15} /></button></div></div>}
                  </div>
                  <div className="form-section"><div className="step-heading"><span>3</span><div><strong>กรอกปริมาณที่ใช้</strong><small>ใช้หน่วยเดียวกับค่า EF ที่เลือก</small></div></div>
                    <div className="form-grid activity-inputs"><label className="field"><span>ชื่อกิจกรรม / รายการ</span><input required value={form.title} placeholder="เช่น รถส่งสินค้าใช้น้ำมันดีเซล" onChange={e => setForm(v => ({ ...v, title: e.target.value }))} /></label><label className="field"><span>ปริมาณ ({form.unit || "หน่วย"})</span><input type="number" min="0.000000001" step="any" required placeholder="0" value={form.quantity} onChange={e => setForm(v => ({ ...v, quantity: e.target.value }))} /></label></div>
                  </div>
                  <div className="advanced"><button type="button" className="advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(!advancedOpen)}><SlidersHorizontal size={16} /> ค่า EF, แหล่งอ้างอิง และหมายเหตุ <ChevronDown size={16} className={advancedOpen ? "rotated" : ""} /></button>
                    {advancedOpen && <div className="advanced-body"><div className="form-grid form-grid-three"><label className="field"><span>หน่วย</span><input required placeholder="เช่น Liter, kWh" value={form.unit} onChange={e => { if (selectedFactor) { setSelectedFactor(null); setCustomFactor(true); } setForm(v => ({ ...v, unit: e.target.value, factorRow: "", factorSource: v.factorRow ? "" : v.factorSource })); }} /></label><label className="field"><span>EF (kgCO₂e/หน่วย)</span><input type="number" step="any" min="0" required value={form.factor} onChange={e => { setSelectedFactor(null); setCustomFactor(true); setForm(v => ({ ...v, factor: e.target.value, factorRow: "", factorSource: v.factorRow ? "" : v.factorSource })); }} /></label><label className="field"><span>ชื่อปัจจัย</span><input required value={form.factorName} onChange={e => setForm(v => ({ ...v, factorName: e.target.value }))} /></label></div>
                      <div className="form-grid"><label className="field"><span>แหล่งอ้างอิง EF</span><input required placeholder="ชื่อเอกสาร เวอร์ชัน และปี" value={form.factorSource} onChange={e => setForm(v => ({ ...v, factorSource: e.target.value }))} /></label><label className="field"><span>หมายเหตุ / เลขที่หลักฐาน</span><input placeholder="เช่น เลขที่ใบแจ้งหนี้" value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} /></label></div>
                      {!!form.factorRow && <p className="source-ref">ตำแหน่งในไฟล์: {form.factorRow}</p>}</div>}
                  </div>
                  <div className="calculation"><div><span>ผลคำนวณจากรายการนี้</span><small>ปริมาณ × EF ÷ 1,000</small></div><strong>{fmt((Number(form.quantity) || 0) * (Number(form.factor) || 0) / 1000, 5)} <small>tCO₂e</small></strong></div>
                  <div className="form-actions"><button type="submit" className="btn primary" disabled={saving}><Save size={17} /> {saving ? "กำลังบันทึก…" : editId ? "บันทึกการแก้ไข" : "บันทึกรายการ"}</button></div>
                </form>
              </section>
              <section className="panel records" ref={recordsRef}><div className="panel-head"><div><h3>รายการที่บันทึก</h3><p>{filteredEntries.length} จาก {entries.length} รายการ</p></div></div><div className="record-filters"><div className="search-box"><Search size={16} /><input aria-label="ค้นหารายการ" placeholder="ค้นหารายการ" value={query} onChange={e => setQuery(e.target.value)} /></div><NativeSelect aria-label="กรองช่วงข้อมูล" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}><option value="all">ทุกปี</option><option value="current">ปีรายงาน</option><option value="base">ปีฐาน</option></NativeSelect><NativeSelect aria-label="กรองขอบเขต" value={scopeFilter} onChange={e => { setScopeFilter(e.target.value); setCategoryFilter("all"); }}><option value="all">ทุก Scope</option>{[1, 2, 3, 4].map(i => <option key={i} value={i}>{i === 4 ? "รายงานแยก" : `Scope ${i}`}</option>)}</NativeSelect>{scopeFilter === "3" && <NativeSelect aria-label="กรองหมวด Scope 3" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">ทุกหมวด Scope 3</option>{categories.map((cat, i) => <option key={cat} value={cat}>{thCategories[i]}</option>)}</NativeSelect>}</div>
                {mismatchOnly && <div className="active-filter"><TriangleAlert size={15} /><span>แสดงเฉพาะวันที่ไม่ตรงช่วงปี ({filteredEntries.length} รายการ)</span><button onClick={() => setMismatchOnly(false)}>แสดงทั้งหมด</button></div>}
                {filteredEntries.length ? <div className="record-list">{filteredEntries.map(e => <article className="record" key={e.id}><div className="record-top"><span className={`badge s${e.scope}`}>{e.scope === 4 ? "แยก" : `S${e.scope}`}</span><strong>{e.title}</strong></div><div className="record-value">{fmt(total(e), 4)} <small>tCO₂e</small></div><div className="record-sub">{e.period === "base" ? "ปีฐาน" : "ปีรายงาน"} · {e.date} · {fmt(e.quantity, 3)} {e.unit}</div>{!dateMatchesPeriod(e.date, e.period === "base" ? profile.baseYear || "" : profile.reportingYear || "") && <div className="record-warning"><TriangleAlert size={14} /> วันที่ไม่ตรงกับ{e.period === "base" ? "ปีฐาน" : "ปีรายงาน"} {e.period === "base" ? profile.baseYear : profile.reportingYear}</div>}{e.scope === 3 && <div className="record-sub">หมวด {thCategories[categories.indexOf(e.scope3Category)] || "ยังไม่ระบุ"}</div>}<div className="record-source">EF {fmt(e.factor, 6)} · {e.factorRow || e.factorName}</div>{e.factorSource && <div className="record-sub">แหล่ง EF: {e.factorSource}</div>}{e.notes && <div className="record-note">หลักฐาน / หมายเหตุ: {e.notes}</div>}<div className="record-actions"><button onClick={() => startEdit(e)}>แก้ไข</button><button className="delete" onClick={() => setConfirmId(e.id)}><Trash2 size={15} /> ลบ</button></div>{confirmId === e.id && <div className="confirm"><span>ยืนยันลบรายการนี้?</span><button onClick={() => setConfirmId(null)}>ยกเลิก</button><button className="danger" disabled={saving} onClick={() => void remove(e.id)}>ลบรายการ</button></div>}</article>)}</div> : <div className="empty"><span className="empty-icon"><ClipboardList size={23} /></span><strong>{mismatchOnly && periodMismatches.length === 0 ? "แก้ไขวันที่ครบแล้ว" : entries.length ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีรายการ"}</strong><p>{mismatchOnly && periodMismatches.length === 0 ? "ไม่มีรายการที่วันที่ไม่ตรงช่วงปีแล้ว" : entries.length ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เมื่อบันทึกกิจกรรม รายการจะแสดงที่นี่"}</p></div>}
              </section>
            </div>
          </TabsContent>
          <TabsContent value="organization" className="tab-content">
            <div className="section-line"><div><span className="section-kicker">FR-01 · ข้อมูลองค์กร</span><h2>ตั้งค่าข้อมูลสำหรับการคำนวณ</h2><p>ข้อมูลส่วนนี้จะถูกใช้ในหน้ารายการและหน้าสรุปโดยอัตโนมัติ</p></div><button className="btn primary" disabled={saving} onClick={() => void saveMeta()}><Save size={17} /> {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</button></div>
            <div className="org-grid"><section className="panel"><div className="panel-head"><div><h3>ข้อมูลพื้นฐาน</h3><p>เริ่มจากข้อมูลที่จำเป็นก่อน</p></div><span className="panel-tag">01</span></div><div className="form-grid">{field("organization", "ชื่อองค์กร", "ชื่อบริษัท / หน่วยงาน")}{field("preparer", "ผู้จัดทำ", "ชื่อผู้รับผิดชอบ")}{field("reportingYear", "ระยะเวลาปีรายงาน", "เช่น ม.ค. 2569 – ธ.ค. 2569")}{field("baseYear", "ระยะเวลาปีฐาน", "เช่น ม.ค. 2567 – ธ.ค. 2567")}</div></section>
              <section className="panel"><div className="panel-head"><div><h3>ผลผลิตและสถานที่</h3><p>ใช้คำนวณความเข้มการปล่อยต่อหน่วยผลผลิต</p></div><span className="panel-tag">02</span></div><div className="form-grid">{field("output", "ผลผลิตปีรายงาน", "เช่น 12000", "number")}{field("baseOutput", "ผลผลิตปีฐาน", "เช่น 10000", "number")}{field("outputUnit", "หน่วยผลผลิต", "เช่น ชิ้น, ตันผลิตภัณฑ์")}{field("address", "สถานที่ติดต่อ", "ที่อยู่หรือสถานประกอบการ")}</div></section></div>
            <div className="section-line subsection"><div><h2>ขอบเขตที่องค์กรมี</h2><p>ระบุเป็นตัวอย่างแหล่งปล่อยของบริษัท เพื่อใช้ประกอบบัญชีรายการ</p></div></div>
            <div className="boundary-grid">{([1, 2, 3] as const).map(i => <section className="panel boundary-card" key={i}><div className="boundary-head"><span className={`badge s${i}`}>S{i}</span><div><h3>{scopes[i].split(" · ")[1]}</h3><small>ประเภท {i}</small></div></div><label className="field"><span>มีแหล่งปล่อยอะไรบ้าง</span><textarea rows={4} value={profile[`boundary${i}` as ProfileField] || ""} placeholder={i === 1 ? "เช่น รถบริษัท เครื่องกำเนิดไฟฟ้า สารทำความเย็น" : i === 2 ? "เช่น ไฟฟ้าที่ซื้อจากการไฟฟ้า" : "เช่น ของเสีย การเดินทางพนักงาน การขนส่งโดยคู่ค้า"} onChange={e => setProfile(p => ({ ...p, [`boundary${i}`]: e.target.value }))} /></label><div className="linked-actions"><button className="text-button" onClick={() => openEntries(String(i))}>ดู {entries.filter(e => e.scope === i).length} รายการ</button><button className="text-button" onClick={() => addScopedEntry(i)}>เพิ่มรายการ <ArrowRight size={14} /></button></div></section>)}</div>
            <section className="panel structure-panel"><div className="panel-head"><div><h3>โครงสร้างและผู้รับผิดชอบ</h3><p>คำอธิบายประกอบ Fr-02 และ Fr-03.1</p></div></div><div className="form-grid form-grid-three">{field("activities", "กิจกรรมและพื้นที่", "เช่น โรงงาน 1 อาคารสำนักงาน")}{field("department", "หน่วยงานที่เกี่ยวข้อง", "เช่น ผลิต คลัง จัดซื้อ")}{field("responsibility", "ผู้รวบรวมและอนุมัติ", "เช่น ฝ่ายสิ่งแวดล้อม / ผู้บริหาร")}</div><p className="hint">บันทึกเป็นข้อความประกอบ ยังไม่ใช่แผนภาพองค์กร</p></section>
          </TabsContent>
          <TabsContent value="significance" className="tab-content">
            <div className="section-line"><div><span className="section-kicker">FR-03.2 · SCOPE 3</span><h2>เลือกกิจกรรมทางอ้อมที่เกี่ยวข้อง</h2><p>เริ่มจากระบุว่าบริษัทมีแหล่งปล่อยประเภทใด แล้วขยายเฉพาะหมวดที่ต้องประเมิน</p></div><button className="btn primary" disabled={saving} onClick={() => void saveMeta()}><Save size={17} /> บันทึกผลประเมิน</button></div>
            <div className="scope-intro"><span className="intro-icon"><CircleHelp size={21} /></span><div><strong>เลือกแล้ว {chosenCategories} จาก 15 หมวด</strong><p>หมวดที่มีรายการบันทึกแล้วจะถูกนับว่ามีในองค์กร และกดดูรายการที่เชื่อมกันได้</p></div></div>
            <div className="sig-list">{categories.map((cat, i) => { const item = sig[cat] || {}; const open = expandedCategory === i; const hasEntries = categoryCounts[cat] > 0; const selectedCriteria = criteria.filter(([key]) => item[key]).map(([, label]) => label); return <article className={`sig-card ${item.present || hasEntries ? "is-selected" : ""}`} key={cat}><div className="sig-main"><span className="sig-index">{String(i + 1).padStart(2, "0")}</span><div className="sig-name"><strong>{thCategories[i]}</strong><small>{cat}{hasEntries ? ` · ${categoryCounts[cat]} รายการที่บันทึก` : ""}</small>{(selectedCriteria.length > 0 || item.note) && <small className="sig-summary">{selectedCriteria.length > 0 && `เกณฑ์: ${selectedCriteria.join(" · ")}`}{selectedCriteria.length > 0 && item.note && " · "}{item.note && `เหตุผล: ${item.note}`}</small>}{hasEntries && <small className="sig-hint">มีรายการบันทึกอยู่ จึงต้องแก้ไขหรือลบรายการก่อนยกเลิกหมวดนี้</small>}</div><label className="check"><input type="checkbox" checked={!!item.present || hasEntries} disabled={hasEntries} onChange={e => setSig(s => ({ ...s, [cat]: { ...item, present: e.target.checked } }))} /> มีในองค์กร</label>{(item.present || hasEntries) && <button type="button" className="text-button" onClick={() => addScopedEntry(3, cat)}>เพิ่มรายการ</button>}{hasEntries && <button type="button" className="text-button" onClick={() => openEntries("3", "all", cat)}>ดูรายการ</button>}<button type="button" className="expand-button" aria-label={`ประเมิน ${thCategories[i]}`} aria-expanded={open} onClick={() => setExpandedCategory(open ? null : i)}><ChevronDown size={19} className={open ? "rotated" : ""} /></button></div>
                    {open && <div className="sig-detail"><p>เกณฑ์ที่เกี่ยวข้องกับหมวดนี้ (เลือกได้หลายข้อ)</p><div className="sig-criteria">{criteria.map(([key, label]) => <label className="check" key={key}><input type="checkbox" checked={!!item[key]} onChange={e => setSig(s => ({ ...s, [cat]: { ...item, [key]: e.target.checked } }))} /> {label}</label>)}</div><label className="field"><span>เหตุผล / หมายเหตุ</span><input value={item.note || ""} placeholder="เช่น มีข้อมูลจากผู้รับจ้างขนส่ง" onChange={e => setSig(s => ({ ...s, [cat]: { ...item, note: e.target.value } }))} /></label></div>}
                  </article>; })}</div>
          </TabsContent>
          <TabsContent value="factors" className="tab-content">
            <div className="section-line"><div><span className="section-kicker">EF TGO AR5 V2</span><h2>เลือกค่า EF ที่บริษัทใช้</h2><p>เลือกปัจจัยที่จะให้ปรากฏในหน้าบันทึกกิจกรรม · {factors.length} ค่าในไฟล์อ้างอิง</p></div><button className="btn primary" disabled={saving} onClick={() => void saveMeta()}><Save size={17} /> บันทึกการตั้งค่า</button></div>
            <section className="panel catalog-settings"><div><h3>ค่า EF ที่บริษัทเลือกใช้</h3><p>ติ๊กปัจจัยที่ใช้จริงในตารางแล้วกดบันทึกการตั้งค่า หน้าบันทึกกิจกรรมจะแสดงเฉพาะค่าที่บันทึกสำเร็จและตรงกับ Scope · ปุ่ม “บันทึกแล้วใช้” จะบันทึกค่าที่ติ๊กทั้งหมดและไปหน้ากิจกรรม</p></div><span className="panel-tag">{factorSelectionDirty ? `รอบันทึก ${(profile.activeFactors || []).length} ค่า` : `บันทึกแล้ว ${savedFactors.length} ค่า`}</span></section>
            <section className="panel catalog-panel"><div className="catalog-toolbar"><div className="search-box"><Search size={17} /><input aria-label="ค้นหาค่า EF" placeholder="ค้นหาเชื้อเพลิง ไฟฟ้า หรือหน่วย" value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} /></div><NativeSelect aria-label="กรองค่า EF ตาม Scope" value={catalogScope} onChange={e => setCatalogScope(e.target.value)}><option value="all">ทุก Scope</option>{Object.entries(scopes).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</NativeSelect><span className="panel-tag">{factorSelectionDirty ? `กำลังเลือก ${(profile.activeFactors || []).length} ค่า · ยังไม่บันทึก` : `บันทึกแล้ว ${savedFactors.length} ค่า`}</span></div><div className="factor-table-wrap"><table className="factor-table"><thead><tr><th>ปัจจัยการปล่อย</th><th>หน่วย</th><th>kgCO₂e/หน่วย</th><th>เลือกใช้</th><th></th></tr></thead><tbody>{catalogMatches.sort((a, b) => Number((profile.activeFactors || []).includes(b.id)) - Number((profile.activeFactors || []).includes(a.id))).map(f => <tr key={f.id}><td><strong>{f.name}</strong><small>{f.defaultScope === 4 ? "รายงานแยก" : `Scope ${f.defaultScope}`} · EF TGO AR5 V2 · แถว {f.row} · {f.source}</small></td><td>{f.unit}</td><td className="numeric">{fmt(f.factor, 6)}</td><td><label className="check"><input type="checkbox" checked={(profile.activeFactors || []).includes(f.id)} onChange={e => toggleCatalogFactor(f, e.target.checked)} /><span className="sr-only">เลือกใช้ {f.name}</span></label></td><td><button className="text-button" disabled={saving} onClick={() => void chooseCatalogFactor(f)}>บันทึกแล้วใช้ <ArrowRight size={14} /></button></td></tr>)}</tbody></table></div>{!catalogMatches.length && <div className="empty"><strong>ไม่พบค่า EF ที่ค้นหา</strong><p>ลองใช้ชื่อรายการหรือหน่วยอื่น หรือเลือก Scope อื่น</p></div>}</section>
            <p className="catalog-note"><Info size={16} /> ค่า EF ต้องตรงกับชนิดกิจกรรมและช่วงปีที่รายงาน ค่าไฟฟ้าในไฟล์มีหลายช่วงปีให้เลือก</p>
          </TabsContent>
        </>}
      </Tabs>
      <footer>อ้างอิง TCFO_R_01 Version 07 · 18/02/2026 · ผลคำนวณใช้ค่าจริงก่อนปัดเศษ</footer>
    </div>
  </main>;
}
