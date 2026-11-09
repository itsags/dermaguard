import { useEffect, useState } from "react";
import { ReferenceUi } from "./ReferenceUi";
import type { Session } from "@supabase/supabase-js";
import { AuthPanel } from "./components/AuthPanel";
import { CaseEditor } from "./components/CaseEditor";
import { CaseForm } from "./components/CaseForm";
import { CarePanelExact as CarePanel } from "./components/CarePanelExact";
import { DashboardHome } from "./components/DashboardHome";
import { ObservationEditor } from "./components/ObservationEditor";
import { ObservationForm } from "./components/ObservationForm";
import { NewSkinCheckPanel } from "./components/NewSkinCheckPanel";
import { PrivatePhoto } from "./components/PrivatePhoto";
import { ProfilePanel, type Profile } from "./components/ProfilePanel";
import { ReportsPanel } from "./components/ReportsPanel";
import { WorkstationHeader } from "./components/WorkstationHeader";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { SafetyNotice } from "./components/SafetyNotice";
import { isConfigured, supabase } from "./lib/supabase";
import type { Case, Observation } from "./lib/types";

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [editingObservation, setEditingObservation] =
    useState<Observation | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<
    "dashboard" | "timeline" | "new-check" | "care" | "reports" | "profile"
  >("dashboard");
  const [profile, setProfile] = useState<Profile>({
    displayName: "",
    location: "",
    avatarPath: null,
  });
  const load = async () => {
    const [{ data: c }, { data: o }] = await Promise.all([
      supabase
        .from("skin_cases")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("observations")
        .select("*")
        .order("noted_at", { ascending: false }),
    ]);
    setCases(c ?? []);
    setObservations(o ?? []);
  };
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, current) =>
      setSession(current),
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session) {
      const metadata = session.user.user_metadata as {
        display_name?: string;
        location?: string;
        avatar_path?: string;
      };
      setProfile({
        displayName: metadata.display_name ?? "",
        location: metadata.location ?? "",
        avatarPath: metadata.avatar_path ?? null,
      });
    }
  }, [session]);
  useEffect(() => {
    if (session) void load();
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`dermaguard-live-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "skin_cases",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "observations",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session]);
  const deleteObservation = async (observation: Observation) => {
    if (!window.confirm("Delete this observation? This cannot be undone."))
      return;
    setError("");
    if (observation.photo_path) {
      const { error: photoError } = await supabase.storage
        .from("dermaguard-photos")
        .remove([observation.photo_path]);
      if (photoError) {
        setError(
          "Could not remove the private photo. The observation was kept.",
        );
        return;
      }
    }
    const { error: deleteError } = await supabase
      .from("observations")
      .delete()
      .eq("id", observation.id);
    if (deleteError) setError(deleteError.message);
    else void load();
  };
  const deleteCase = async (skinCase: Case) => {
    if (
      !window.confirm(
        `Delete “${skinCase.title}” and all its observations? This cannot be undone.`,
      )
    )
      return;
    setError("");
    const photoPaths = observations
      .filter(
        (observation) =>
          observation.case_id === skinCase.id && observation.photo_path,
      )
      .map((observation) => observation.photo_path as string);
    if (photoPaths.length) {
      const { error: photoError } = await supabase.storage
        .from("dermaguard-photos")
        .remove(photoPaths);
      if (photoError) {
        setError("Could not remove the private photos. The case was kept.");
        return;
      }
    }
    const { error: deleteError } = await supabase
      .from("skin_cases")
      .delete()
      .eq("id", skinCase.id);
    if (deleteError) setError(deleteError.message);
    else {
      setSelected(null);
      void load();
    }
  };
  const exportRecords = () => {
    const data = {
      exported_at: new Date().toISOString(),
      notice:
        "DermaGuard is an observation record, not a diagnosis. Private photo files are not included in this download.",
      cases,
      observations,
    };
    const file = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = `dermaguard-record-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };
  // The supplied UI remains available as a full, interactive local preview
  // until the project’s Supabase environment values are added.
  if (!isConfigured) return new URLSearchParams(window.location.search).get("preview") === "studio" ? <ReferenceUi /> : <AuthPanel />;
  if (!session) return <AuthPanel />;
  const selectedCase = selected ?? cases[0]?.id;
  const navigation = (
    <nav className="space-y-1.5">
      <NavButton
        active={view === "dashboard"}
        onClick={() => setView("dashboard")}
        label="Dashboard"
      />
      <NavButton
        active={view === "new-check"}
        onClick={() => setView("new-check")}
        label="Scan Studio"
      />
      <NavButton
        active={view === "timeline"}
        onClick={() => setView("timeline")}
        label="Progression Tracking"
      />
      <NavButton
        active={view === "care"}
        onClick={() => setView("care")}
        label="Nearby Clinics"
      />
      <NavButton
        active={view === "reports"}
        onClick={() => setView("reports")}
        label="Health Reports"
      />
      <NavButton
        active={view === "profile"}
        onClick={() => setView("profile")}
        label="Patient Details"
      />
    </nav>
  );
  const timeline = (
    <section>
      <div className="mb-5">
        <p className="text-sm font-semibold text-sky-700">Personal timeline</p>
        <h2 className="mt-1 text-2xl font-bold">My cases</h2>
        <p className="mt-1 text-sm text-slate-600">
          Keep private notes and photos together over time.
        </p>
      </div>
      <CaseForm onCreated={() => void load()} />
      {editingCase && (
        <CaseEditor
          skinCase={editingCase}
          onCancel={() => setEditingCase(null)}
          onSaved={() => {
            setEditingCase(null);
            void load();
          }}
        />
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {cases.map((c) => (
          <div
            key={c.id}
            className={
              "rounded-xl border p-4 text-left " +
              (selectedCase === c.id
                ? "border-sky-500 bg-sky-50"
                : "border-slate-200 bg-white")
            }
          >
            <button
              className="w-full text-left"
              onClick={() => setSelected(c.id)}
            >
              <strong>{c.title}</strong>
              <span className="block text-sm text-slate-600">
                {c.body_area}
              </span>
            </button>
            <div className="mt-3 flex gap-3 text-sm">
              <button className="underline" onClick={() => setEditingCase(c)}>
                Edit
              </button>
              <button
                className="text-red-700 underline"
                onClick={() => void deleteCase(c)}
              >
                Delete case
              </button>
            </div>
          </div>
        ))}
      </div>
      {!cases.length && (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">
          Start by creating a private case above.
        </p>
      )}
      {selectedCase && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Observation timeline</h2>
          <ObservationForm
            caseId={selectedCase}
            onCreated={() => void load()}
          />
          <ul className="mt-4 space-y-3">
            {observations
              .filter((o) => o.case_id === selectedCase)
              .map((o) => (
                <li
                  key={o.id}
                  className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
                >
                  <time className="text-sm text-slate-500">
                    {new Date(o.noted_at).toLocaleString()}
                  </time>
                  <p className="mt-1 font-medium">
                    {o.symptoms.join(", ") || "No symptoms selected"}
                  </p>
                  {o.notes && <p className="mt-1 text-slate-700">{o.notes}</p>}
                  {o.photo_path && <PrivatePhoto path={o.photo_path} />}
                  {editingObservation?.id === o.id ? (
                    <ObservationEditor
                      observation={o}
                      onCancel={() => setEditingObservation(null)}
                      onSaved={() => {
                        setEditingObservation(null);
                        void load();
                      }}
                    />
                  ) : (
                    <div className="mt-3 flex gap-3 text-sm">
                      <button
                        className="underline"
                        onClick={() => setEditingObservation(o)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-700 underline"
                        onClick={() => void deleteObservation(o)}
                      >
                        Delete observation
                      </button>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </section>
  );
  return (
    <main className="min-h-screen bg-[#f4f6fa] p-0 sm:p-2 lg:p-3">
      <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[1600px] overflow-hidden bg-white lg:rounded-[38px] lg:border lg:border-slate-300 lg:shadow-[0_35px_80px_-20px_rgba(15,23,42,0.14)]">
        <aside className="hidden w-[220px] shrink-0 flex-col justify-between border-r border-slate-200 bg-[#fbfcfe] p-6 lg:flex">
          <div>
            <div className="mb-8 flex items-center gap-2.5">
              <DermaMark />
              <span className="text-xl font-black tracking-tight text-black">
                DERMAGUARD
              </span>
            </div>
            {navigation}
          </div>
          <AccountCard
            email={session.user.email ?? ""}
            onSignOut={() => void supabase.auth.signOut().then(({ error }) => { if (error) setError(error.message); else window.location.replace(window.location.pathname); })}
            onProfile={() => setView("profile")}
          />
        </aside>
        <aside className="hidden w-16 shrink-0 flex-col items-center border-r border-slate-200 bg-[#fbfcfe] py-5 md:flex lg:hidden">
          <DermaMark />
          <TabletNav view={view} setView={setView} />
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto pb-24 md:pb-0">
          <WorkstationHeader
            email={session.user.email ?? ""}
            onReports={() => setView("reports")}
          />
          <div className="border-b border-slate-100 bg-[#fbfcfe] px-4 py-3 md:hidden">
            {navigation}
          </div>
          <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
            <div className="mb-6 flex items-center justify-end gap-3 text-sm">
              <button
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold shadow-sm"
                onClick={exportRecords}
              >
                Download record
              </button>
            </div>
            <SafetyNotice />
            {error && (
              <p
                className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="mt-6">
              {view === "dashboard" && (
                <DashboardHome
                  email={session.user.email ?? "there"}
                  cases={cases}
                  observations={observations}
                  onOpenTimeline={() => setView("timeline")}
                  onOpenCare={() => setView("care")}
                  onOpenProfile={() => setView("profile")}
                />
              )}
              {view === "timeline" && timeline}
              {view === "new-check" && (
                <NewSkinCheckPanel
                  cases={cases}
                  selectedCase={selectedCase}
                  onSelectCase={setSelected}
                  onSaved={() => {
                    void load();
                    setView("timeline");
                  }}
                />
              )}
              {view === "care" && <CarePanel />}
              {view === "reports" && (
                <ReportsPanel
                  cases={cases}
                  observations={observations}
                  onOpenTimeline={() => setView("timeline")}
                />
              )}
              {view === "profile" && (
                <ProfilePanel
                  email={session.user.email ?? ""}
                  profile={profile}
                  onUpdated={setProfile}
                />
              )}
            </div>
          </div>
        </div>
        <HistoryDrawer
          observations={observations}
          onNavigate={(next) => setView(next)}
        />
      </div>
      <MobileNav view={view} setView={setView} />
    </main>
  );
}

function NavButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const icon =
    label === "Dashboard"
      ? "⌂"
      : label === "Scan Studio"
        ? "✦"
        : label === "Progression Tracking"
          ? "◷"
          : label === "Nearby Clinics"
            ? "⌖"
            : "◉";
  return (
    <button
      className={
        "w-full rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition " +
        (active
          ? "border border-slate-100 bg-white font-bold text-black shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-black")
      }
      onClick={onClick}
    >
      <span className="mr-3">{icon}</span>
      {label}
    </button>
  );
}
function DermaMark() {
  return <img src="/images/dermaguard-logo.svg" alt="DermaGuard" className="h-8 w-8 shrink-0"/>;
}
function AccountCard({
  email,
  onProfile,
  onSignOut,
}: {
  email: string;
  onSignOut: () => void;
  onProfile: () => void;
}) {
  return (
    <div className="rounded-2xl bg-[#8ea0b7] p-3.5 text-white shadow-sm">
      <div className="flex items-center gap-2.5">
        <img
          className="h-10 w-10 rounded-xl border-2 border-white/60 object-cover"
          src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80"
          alt="Patient" onClick={onProfile} style={{ cursor: "pointer" }}
        />
        <div className="min-w-0 leading-snug">
          <button type="button" onClick={onProfile} className="truncate text-[13px] font-bold">{email}</button>
          <p className="truncate text-[11px] text-white/85">
            Chennai, Tamil Nadu
          </p>
        </div>
      </div>
      <button
        className="mt-3 w-full rounded-xl bg-[#111827] py-2.5 text-xs font-bold"
        onClick={onSignOut}
      >
        Log out
      </button>
    </div>
  );
}
function MobileNav({
  view,
  setView,
}: {
  view: string;
  setView: (
    view:
      | "dashboard"
      | "timeline"
      | "new-check"
      | "care"
      | "reports"
      | "profile",
  ) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <MobileButton
        active={view === "dashboard"}
        label="Home"
        icon="⌂"
        onClick={() => setView("dashboard")}
      />
      <MobileButton
        active={view === "timeline"}
        label="Timeline"
        icon="◷"
        onClick={() => setView("timeline")}
      />
      <MobileButton
        active={view === "new-check"}
        label="New check"
        icon="＋"
        onClick={() => setView("new-check")}
      />
      <MobileButton
        active={view === "care"}
        label="Care"
        icon="⌖"
        onClick={() => setView("care")}
      />
      <MobileButton
        active={view === "reports"}
        label="Reports"
        icon="▦"
        onClick={() => setView("reports")}
      />
      <MobileButton
        active={view === "profile"}
        label="Profile"
        icon="◉"
        onClick={() => setView("profile")}
      />
    </nav>
  );
}
function MobileButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        "flex flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-bold " +
        (active ? "text-sky-700" : "text-slate-500")
      }
      onClick={onClick}
    >
      <span className="text-lg leading-5">{icon}</span>
      {label}
    </button>
  );
}
function TabletNav({
  view,
  setView,
}: {
  view: string;
  setView: (
    view:
      | "dashboard"
      | "timeline"
      | "new-check"
      | "care"
      | "reports"
      | "profile",
  ) => void;
}) {
  return (
    <div className="mt-8 flex flex-col gap-3">
      <TabletButton
        active={view === "dashboard"}
        label="⌂"
        onClick={() => setView("dashboard")}
      />
      <TabletButton
        active={view === "timeline"}
        label="◷"
        onClick={() => setView("timeline")}
      />
      <TabletButton
        active={view === "new-check"}
        label="＋"
        onClick={() => setView("new-check")}
      />
      <TabletButton
        active={view === "care"}
        label="⌖"
        onClick={() => setView("care")}
      />
      <TabletButton
        active={view === "reports"}
        label="▦"
        onClick={() => setView("reports")}
      />
      <TabletButton
        active={view === "profile"}
        label="◉"
        onClick={() => setView("profile")}
      />
    </div>
  );
}
function TabletButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label="Navigate"
      className={
        "grid h-10 w-10 place-items-center rounded-xl text-xl " +
        (active
          ? "bg-white text-sky-700 shadow-sm"
          : "text-slate-500 hover:bg-slate-100")
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}
