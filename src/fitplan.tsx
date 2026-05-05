import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import "./fitplan.css";
import {
  loadPersistedFitPlanState,
  savePersistedFitPlanState,
} from "./fitplanPersistence";

type ExerciseType = "WOD" | "Hyrox" | "Force";
type ExerciseUnit = "reps" | "m" | "cal";
type WodType = "AMRAP" | "EMOM" | "For Time" | "Force" | "Libre";
type Tab = "cycle" | "history" | "stats";

type ExerciseDefinition = {
  name: string;
  type: ExerciseType;
  equipment: string[];
  unit: ExerciseUnit;
};

type SessionExercise = ExerciseDefinition & {
  reps: number;
  weight: number;
  distance: number;
};

type SessionForm = {
  type: WodType;
  duration: number;
  rounds: number;
  notes: string;
  exercises: SessionExercise[];
};

type Session = SessionForm & {
  date: string;
};

type EditSession = {
  dateKey: string;
  weekIdx: number;
  isNew: boolean;
};

type CssVars = CSSProperties & Record<`--${string}`, string | number>;

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function cssVars(vars: Record<`--${string}`, string | number>): CssVars {
  return vars as CssVars;
}

function ignoreStorageError(error: unknown) {
  void error;
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const EQUIPMENT_LIST: string[] = [
  "Haltères","Barbell","Kettlebell","SkiErg","Sled Push","Sled Pull",
  "Wall Balls","Rowing","Anneaux","Pull-up bar","Box","Vélo assault","Corde à sauter","Bodyweight"
];
const ALL_EXERCISES: ExerciseDefinition[] = [
  { name:"Thruster", type:"WOD", equipment:["Barbell","Haltères"], unit:"reps" },
  { name:"Burpee", type:"WOD", equipment:["Bodyweight"], unit:"reps" },
  { name:"Double Under", type:"WOD", equipment:["Corde à sauter"], unit:"reps" },
  { name:"Box Jump", type:"WOD", equipment:["Box"], unit:"reps" },
  { name:"Toes to Bar", type:"WOD", equipment:["Pull-up bar"], unit:"reps" },
  { name:"Wall Ball", type:"Hyrox", equipment:["Wall Balls"], unit:"reps" },
  { name:"SkiErg", type:"Hyrox", equipment:["SkiErg"], unit:"m" },
  { name:"Sled Push", type:"Hyrox", equipment:["Sled Push"], unit:"m" },
  { name:"Sled Pull", type:"Hyrox", equipment:["Sled Pull"], unit:"m" },
  { name:"Rowing", type:"Hyrox", equipment:["Rowing"], unit:"m" },
  { name:"Vélo Assault", type:"Hyrox", equipment:["Vélo assault"], unit:"cal" },
  { name:"Squat", type:"Force", equipment:["Barbell","Haltères","Bodyweight"], unit:"reps" },
  { name:"Deadlift", type:"Force", equipment:["Barbell"], unit:"reps" },
  { name:"Bench Press", type:"Force", equipment:["Barbell","Haltères"], unit:"reps" },
  { name:"Strict Press", type:"Force", equipment:["Barbell","Haltères"], unit:"reps" },
  { name:"Pull-up", type:"Force", equipment:["Pull-up bar","Anneaux"], unit:"reps" },
  { name:"Ring Dip", type:"Force", equipment:["Anneaux"], unit:"reps" },
  { name:"Kettlebell Swing", type:"Force", equipment:["Kettlebell"], unit:"reps" },
  { name:"Turkish Get-Up", type:"Force", equipment:["Kettlebell","Haltères"], unit:"reps" },
];
const WOD_TYPES: WodType[] = ["AMRAP","EMOM","For Time","Force","Libre"];
const TYPE_COLORS: Record<ExerciseType, string> = { WOD:"#f97316", Hyrox:"#3b82f6", Force:"#8b5cf6" };
const TYPE_BG: Record<ExerciseType, string> = { WOD:"#fff7ed", Hyrox:"#eff6ff", Force:"#f5f3ff" };
const initialEquip = new Set<string>(["Barbell","Haltères","Kettlebell","Wall Balls","Pull-up bar","Box","Bodyweight","Corde à sauter","SkiErg","Rowing"]);
const emptyForm: SessionForm = { type:"AMRAP", duration:20, rounds:3, notes:"", exercises:[] };

const WEEK_LABELS = ["Semaine 1 — Base", "Semaine 2 — Progression", "Semaine 3 — Pic", "Semaine 4 — Deload"];
const WEEK_COLORS = ["#3b82f6","#f97316","#8b5cf6","#10b981"];
const WEEK_BG = ["#eff6ff","#fff7ed","#f5f3ff","#ecfdf5"];
const WEEK_DESC = [
  "Volume modéré, technique et mise en place des patterns de mouvement.",
  "Volume et intensité en hausse. Surcharge progressive.",
  "Intensité maximale, volume contrôlé. Séances peak.",
  "Volume et intensité réduits de 40-50%. Récupération active."
];
const PROGRESSION = [1.0, 1.1, 1.2, 0.6]; // multiplicateurs volume/intensité

function getWeekDates(startMs: number, weekIdx: number) {
  return Array.from({length:7}, (_,i) => {
    const d = new Date(startMs);
    d.setDate(d.getDate() + weekIdx * 7 + i);
    return d;
  });
}
function fmtFull(d: Date) { return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()}`; }
function parseFmt(str: string) { const [d,m,y]=str.split("/").map(Number); return new Date(y,m-1,d); }
function toInputDate(d: Date) { return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`; }
function fromInputDate(str: string) { const [y,m,d]=str.split("-").map(Number); return new Date(y,m-1,d); }

export default function FitPlan() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("cycle");
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [equipment, setEquipment] = useState(initialEquip);
  const [customEquipment, setCustomEquipment] = useState(new Set(EQUIPMENT_LIST));
  const [newEquipInput, setNewEquipInput] = useState("");
  const [showEquip, setShowEquip] = useState(false);
  const [modal, setModal] = useState<"session" | null>(null);
  const [editSession, setEditSession] = useState<EditSession | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [exFilter, setExFilter] = useState<ExerciseType | "Tous">("Tous");
  const [tempEx, setTempEx] = useState<string | null>(null);
  const [tempParams, setTempParams] = useState({ reps:10, weight:0, distance:0 });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [cycleStart, setCycleStart] = useState<Date | null>(null); // Date objet
  const [cycleInputVal, setCycleInputVal] = useState("");
  const [viewWeek, setViewWeek] = useState(0); // 0-3 index dans le cycle

  // persistance
  useEffect(() => {
    async function load() {
      try {
        const state = await loadPersistedFitPlanState();
        setSessions(state.sessions as Record<string, Session>);
        setEquipment(new Set(state.equipment));
        setCustomEquipment(new Set(state.customEquipment));

        if (state.cycleStart !== null) {
          const d = new Date(state.cycleStart);
          setCycleStart(d);
          setCycleInputVal(toInputDate(d));
        } else {
          setCycleStart(null);
          setCycleInputVal("");
        }
      } catch (error) {
        ignoreStorageError(error);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);
  useEffect(() => {
    if (!loaded) return;

    savePersistedFitPlanState({
      sessions,
      equipment: [...equipment],
      customEquipment: [...customEquipment],
      cycleStart: cycleStart?.getTime() ?? null,
    }).catch(ignoreStorageError);
  }, [sessions, equipment, customEquipment, cycleStart, loaded]);

  // semaine courante dans le cycle
  const currentCycleWeek = cycleStart ? (() => {
    const now = new Date(); now.setHours(0,0,0,0);
    const diff = Math.floor((now.getTime() - cycleStart.getTime()) / 86400000);
    if (diff < 0) return null;
    const w = Math.floor(diff / 7);
    return w < 4 ? w : null;
  })() : null;

  const availableEx = ALL_EXERCISES.filter(ex => ex.equipment.some(e => equipment.has(e)));

  function addCustomEquip() {
    const val = newEquipInput.trim(); if (!val) return;
    setCustomEquipment(prev => new Set([...prev, val]));
    setEquipment(prev => new Set([...prev, val]));
    setNewEquipInput("");
  }

  function openNew(dateKey: string, weekIdx: number) {
    setEditSession({ dateKey, weekIdx, isNew: true });
    setForm(emptyForm); setTempEx(null); setGenError(null);
    setModal("session");
  }
  function openEdit(dateKey: string, weekIdx: number) {
    const s = sessions[dateKey]; if (!s) return;
    setEditSession({ dateKey, weekIdx, isNew: false });
    setForm({...s}); setTempEx(null); setGenError(null);
    setModal("session");
  }
  function saveSession() {
    if (!editSession) return;
    if (form.exercises.length === 0) return;
    setSessions(prev => ({...prev, [editSession.dateKey]: {...form, date: editSession.dateKey}}));
    setModal(null);
  }
  function deleteSession(dateKey: string) {
    setSessions(prev => { const n={...prev}; delete n[dateKey]; return n; });
    setModal(null);
  }
  function addExercise() {
    if (!tempEx) return;
    const ex = ALL_EXERCISES.find(e => e.name === tempEx); if (!ex) return;
    setForm(f => ({...f, exercises:[...f.exercises, {...ex, ...tempParams}]}));
    setTempEx(null); setTempParams({reps:10, weight:0, distance:0});
  }
  function removeEx(i: number) { setForm(f => ({...f, exercises: f.exercises.filter((_,idx)=>idx!==i)})); }

  async function generateSession() {
    setGenerating(true); setGenError(null);
    const equipList = [...equipment].join(", ");
    const weekIdx = editSession?.weekIdx ?? 0;
    const prog = PROGRESSION[weekIdx];
    const isDeload = weekIdx === 3;
    const weekLabel = WEEK_LABELS[weekIdx];

    const weekDates = cycleStart ? getWeekDates(cycleStart.getTime(), weekIdx) : [];
    const weekSessions = weekDates.map(d => sessions[fmtFull(d)]).filter(Boolean);
    const hi = weekSessions.filter(s => ["AMRAP","EMOM","For Time"].includes(s.type)).length;
    const st = weekSessions.filter(s => s.type === "Force").length;
    const en = weekSessions.filter(s => s.type === "Libre").length;
    const weekSummary = weekSessions.length === 0 ? "Aucune séance effectuée cette semaine." : weekSessions.map(s=>`- ${s.date} : ${s.type} (${s.exercises.map(e=>e.name).join(", ")})`).join("\n");

    const prompt = `Tu es un coach CrossFit/Hyrox expert en périodisation. Génère une séance adaptée au contexte du cycle et de la semaine. Réponds UNIQUEMENT avec un objet JSON valide, sans backticks, sans commentaires.

Matériel disponible : ${equipList}
Type demandé : ${form.type}
Durée cible : ${form.duration} minutes
Nombre de tours : ${form.rounds}

=== CONTEXTE DU CYCLE ===
Semaine dans le cycle : ${weekLabel}
Multiplicateur de volume/intensité : ${prog} (base 1.0)
${isDeload ? "⚠️ DELOAD : Réduire le volume et l'intensité de 40-50%. Charges légères, mouvements techniques, pas d'effort maximal." : `Progression automatique : ajuste les charges et volumes selon le facteur ${prog}.`}

=== SÉANCES DÉJÀ EFFECTUÉES CETTE SEMAINE ===
${weekSummary}
- Haute intensité : ${hi}/2
- Force : ${st}/2-3  
- Endurance : ${en}/1

=== RÈGLES ===
- Respecte la phase du cycle (${weekLabel}) dans le choix des charges, volumes et intensité
- Évite de répéter les exercices déjà pratiqués cette semaine
- Adapte l'intensité selon la fatigue accumulée
- Choisis le nombre d'exercices adapté au type et à la durée, sans contrainte de nombre
- Poids de référence pour un athlète intermédiaire, ajustés par le facteur ${prog}

{
  "type": "AMRAP"|"EMOM"|"For Time"|"Force"|"Libre",
  "duration": number,
  "rounds": number,
  "notes": "description de la séance et son rôle dans le cycle",
  "exercises": [
    { "name":"nom", "type":"WOD"|"Hyrox"|"Force", "unit":"reps"|"m"|"cal", "reps":number, "weight":number, "distance":number }
  ]
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1200, messages:[{role:"user",content:prompt}] })
      });
      const data = await res.json() as { content?: { text?: string }[] };
      const text = data.content?.map((b) => b.text||"").join("")||"";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim()) as Partial<SessionForm>;
      setForm(f => ({...f, type:parsed.type||f.type, duration:parsed.duration||f.duration, rounds:parsed.rounds||f.rounds, notes:parsed.notes||f.notes, exercises:parsed.exercises||f.exercises}));
    } catch { setGenError("Erreur lors de la génération. Réessayez."); }
    finally { setGenerating(false); }
  }

  const allSessions = Object.values(sessions).sort((a,b) => parseFmt(b.date).getTime()-parseFmt(a.date).getTime());
  const exCount = allSessions.reduce<Record<string, number>>((acc,s) => { s.exercises.forEach(e=>{acc[e.name]=(acc[e.name]||0)+1;}); return acc; }, {});
  const topEx = Object.entries(exCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const sessionsByType = allSessions.reduce<Partial<Record<WodType, number>>>((acc,s) => { acc[s.type]=(acc[s.type]||0)+1; return acc; }, {});

  if (!loaded) return <div className="fitplan-loading">Chargement…</div>;

  // rendu d'une semaine (cycle ou planning)
  function renderWeek(weekIdx: number) {
    if (!cycleStart) return null;
    const dates = getWeekDates(cycleStart.getTime(), weekIdx);
    const isDeload = weekIdx === 3;
    return (
      <div className="fitplan-week-list">
        {dates.map((date,i) => {
          const key = fmtFull(date);
          const s = sessions[key];
          const isToday = fmtFull(new Date())===key;
          return (
            <div key={key} className="fitplan-day-row">
              <div className={classNames("fitplan-day-tile", isToday && "is-today", isDeload && "is-deload")}>
                <p className="fitplan-day-label">{DAYS[i]}</p>
                <p className="fitplan-day-number">{date.getDate()}</p>
              </div>
              {s ? (
                <div onClick={()=>openEdit(key,weekIdx)} className="fitplan-session-card">
                  <div className="fitplan-session-main">
                    <div className="fitplan-session-details">
                      <span className="fitplan-badge">{s.type}</span>
                      {s.duration&&<span className="fitplan-muted">{s.duration} min</span>}
                      {s.rounds&&<span className="fitplan-muted">{s.rounds} tours</span>}
                    </div>
                    <p className="fitplan-session-summary">
                      {s.exercises.slice(0,3).map(e=>e.name).join(" · ")}{s.exercises.length>3?` +${s.exercises.length-3}`:""}
                    </p>
                  </div>
                  <span className="fitplan-arrow">›</span>
                </div>
              ) : (
                <button onClick={()=>openNew(key,weekIdx)} className={classNames("fitplan-add-session", isDeload && "is-deload")}>
                  {isDeload?"+ Séance récupération":"+ Ajouter une séance"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="fitplan">
      {/* Header */}
      <div className="fitplan-header">
        <div>
          <p className="fitplan-title">FitPlan</p>
          <p className="fitplan-subtitle">CrossFit · Hyrox · Force</p>
        </div>
        <button onClick={()=>setShowEquip(v=>!v)} className="fitplan-header-button">
          {showEquip?"Fermer matériel":"Matériel"}
        </button>
      </div>

      {/* Panneau matériel */}
      {showEquip && (
        <div className="fitplan-panel">
          <div className="fitplan-panel-header">
            <p className="fitplan-section-title">Matériel disponible</p>
            <span className="fitplan-muted">{equipment.size} actif{equipment.size>1?"s":""}</span>
          </div>
          <div className="fitplan-equipment-grid">
            {[...customEquipment].map(eq => {
              const on = equipment.has(eq);
              const isCustom = !EQUIPMENT_LIST.includes(eq);
              return (
                <div key={eq} className={classNames("fitplan-equipment-chip", on && "is-active")}>
                  <button onClick={()=>setEquipment(prev=>{const n=new Set(prev); if (on) n.delete(eq); else n.add(eq); return n;})} className="fitplan-equipment-toggle">{eq}</button>
                  {isCustom&&<button onClick={()=>{setCustomEquipment(prev=>{const n=new Set(prev);n.delete(eq);return n;});setEquipment(prev=>{const n=new Set(prev);n.delete(eq);return n;});}} className="fitplan-equipment-remove">✕</button>}
                </div>
              );
            })}
          </div>
          <div className="fitplan-equipment-form">
            <input type="text" value={newEquipInput} onChange={e=>setNewEquipInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addCustomEquip();}} placeholder="Ajouter un équipement…" className="fitplan-equipment-input" />
            <button onClick={addCustomEquip} className="fitplan-primary-button">+ Ajouter</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="fitplan-tabs">
        {([
          ["cycle","Cycle"],
          ["history","Historique"],
          ["stats","Stats"],
        ] as [Tab, string][]).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} className={classNames("fitplan-tab", tab===k && "is-active")}>{l}</button>
        ))}
      </div>

      {/* Onglet Cycle */}
      {tab==="cycle" && (
        <div>
          {/* Configuration du cycle */}
          <div className="fitplan-card">
            <div className="fitplan-week-header">
              <p className="fitplan-section-title">Cycle en cours</p>
              {currentCycleWeek!==null&&<span className="fitplan-badge" style={cssVars({"--badge-bg": WEEK_BG[currentCycleWeek], "--badge-color": WEEK_COLORS[currentCycleWeek]})}>{WEEK_LABELS[currentCycleWeek]}</span>}
            </div>
            <div className="fitplan-cycle-form">
              <label className="fitplan-label fitplan-cycle-label">Début du cycle</label>
              <input type="date" value={cycleInputVal} onChange={e=>{setCycleInputVal(e.target.value);if(e.target.value){const d=fromInputDate(e.target.value);setCycleStart(d);}}} className="fitplan-date-input" />
            </div>
            {/* Barre des 4 semaines */}
            <div className="fitplan-week-tabs">
              {WEEK_LABELS.map((_,i)=>{
                const isCurrent = currentCycleWeek===i;
                const isViewed = viewWeek===i;
                const wd = cycleStart ? getWeekDates(cycleStart.getTime(),i) : [];
                const count = wd.filter(d=>sessions[fmtFull(d)]).length;
                return (
                  <button key={i} onClick={()=>setViewWeek(i)} className="fitplan-week-tab" style={cssVars({"--week-color": WEEK_COLORS[i], "--week-bg": isCurrent?WEEK_BG[i]:"var(--color-background-secondary)", "--week-border-width": isViewed?"2px":"1px", "--week-border-color": isViewed?WEEK_COLORS[i]:"var(--color-border-tertiary)"})}>
                    {isCurrent&&<div className="fitplan-current-dot"/>}
                    <p className="fitplan-week-number">S{i+1}</p>
                    <p className="fitplan-week-name">{i===3?"Deload":["Base","Prog.","Pic"][i]}</p>
                    <p className="fitplan-week-count">{count}/7</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Semaine sélectionnée */}
          {cycleStart ? (
            <div>
              <div className="fitplan-week-header">
                <div>
                  <p className="fitplan-week-title" style={cssVars({"--week-color": WEEK_COLORS[viewWeek]})}>{WEEK_LABELS[viewWeek]}</p>
                  <p className="fitplan-week-desc">{WEEK_DESC[viewWeek]}</p>
                </div>
                <div className="fitplan-nav-buttons">
                  <button onClick={()=>setViewWeek(w=>Math.max(0,w-1))} disabled={viewWeek===0} className="fitplan-nav-button">←</button>
                  <button onClick={()=>setViewWeek(w=>Math.min(3,w+1))} disabled={viewWeek===3} className="fitplan-nav-button">→</button>
                </div>
              </div>
              {/* Bilan semaine */}
              {(() => {
                const wd = getWeekDates(cycleStart.getTime(),viewWeek);
                const ws = wd.map(d=>sessions[fmtFull(d)]).filter(Boolean);
                const hi=ws.filter(s=>["AMRAP","EMOM","For Time"].includes(s.type)).length;
                const st=ws.filter(s=>s.type==="Force").length;
                const en=ws.filter(s=>s.type==="Libre").length;
                const pills = viewWeek===3
                  ? [{label:"Récup",val:ws.length,target:3,color:"#10b981",bg:"#ecfdf5"}]
                  : [{label:"Intensité",val:hi,target:2,color:"#f97316",bg:"#fff7ed"},{label:"Force",val:st,target:3,color:"#8b5cf6",bg:"#f5f3ff"},{label:"Endurance",val:en,target:1,color:"#3b82f6",bg:"#eff6ff"}];
                return (
                  <div className="fitplan-summary">
                    {pills.map(p=>(
                      <div key={p.label} className="fitplan-summary-item">
                        <p className="fitplan-summary-label">{p.label}</p>
                        <div className="fitplan-dots">
                          {Array.from({length:p.target}).map((_,i)=>(
                            <div key={i} className="fitplan-dot" style={cssVars({"--dot-bg": i<p.val?p.color:"var(--color-border-tertiary)", "--dot-border": i<p.val?p.color:"var(--color-border-secondary)"})}/>
                          ))}
                        </div>
                        <p className="fitplan-summary-count" style={cssVars({"--summary-color": p.val>=p.target?p.color:"var(--color-text-tertiary)", "--summary-weight": p.val>=p.target?500:400})}>{p.val}/{p.target}</p>
                      </div>
                    ))}
                    <div className="fitplan-summary-progress">
                      <p className="fitplan-summary-label">Progression</p>
                      <p className="fitplan-progress-value" style={cssVars({"--week-color": WEEK_COLORS[viewWeek]})}>{Math.round(PROGRESSION[viewWeek]*100)}%</p>
                    </div>
                  </div>
                );
              })()}
              {renderWeek(viewWeek)}
            </div>
          ) : (
            <div className="fitplan-empty">
              <p className="fitplan-empty-text">Choisissez une date de début pour démarrer votre cycle.</p>
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      {tab==="history" && (
        <div>
          {allSessions.length===0 ? (
            <p className="fitplan-empty">Aucune séance enregistrée</p>
          ) : allSessions.map(s=>(
            <div key={s.date} className="fitplan-history-card">
              <div className="fitplan-history-header">
                <div className="fitplan-session-details">
                  <span className="fitplan-badge">{s.type}</span>
                  {s.duration&&<span className="fitplan-muted">{s.duration} min</span>}
                  {s.rounds&&<span className="fitplan-muted">{s.rounds} tours</span>}
                </div>
                <span className="fitplan-meta">{s.date}</span>
              </div>
              <div className="fitplan-tag-list">
                {s.exercises.map((e,i)=>(
                  <div key={i} className="fitplan-chip" style={cssVars({"--chip-border": `${TYPE_COLORS[e.type]}30`, "--chip-bg": TYPE_BG[e.type], "--chip-color": TYPE_COLORS[e.type]})}>
                    {e.name} {e.unit==="reps"?`${e.reps} reps`:e.unit==="m"?`${e.distance}m`:`${e.reps} cal`}
                    {e.weight>0&&` · ${e.weight}kg`}
                  </div>
                ))}
              </div>
              {s.notes&&<p className="fitplan-notes">{s.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {tab==="stats" && (
        <div>
          <div className="fitplan-stats-grid">
            {[["Séances",allSessions.length],["Exercices",Object.keys(exCount).length],["Cycle",currentCycleWeek!==null?`S${currentCycleWeek+1}/4`:"—"]].map(([l,v])=>(
              <div key={l} className="fitplan-stat-card">
                <p className="fitplan-stat-label">{l}</p>
                <p className="fitplan-stat-value">{v}</p>
              </div>
            ))}
          </div>
          {topEx.length>0&&(
            <div className="fitplan-stats-panel has-bottom-space">
              <p className="fitplan-subheading">Exercices les plus pratiqués</p>
              {topEx.map(([name,count])=>{
                const ex=ALL_EXERCISES.find(e=>e.name===name);
                return (
                  <div key={name} className="fitplan-chart-row">
                    <span className="fitplan-ex-type" style={cssVars({"--chip-bg": ex?TYPE_BG[ex.type]:"#f3f4f6", "--chip-color": ex?TYPE_COLORS[ex.type]:"#6b7280"})}>{ex?.type}</span>
                    <span className="fitplan-chart-name">{name}</span>
                    <div className="fitplan-bar">
                      <div className="fitplan-bar-fill" style={cssVars({"--bar-width": `${Math.round((count/topEx[0][1])*100)}%`})}/>
                    </div>
                    <span className="fitplan-count">{count}x</span>
                  </div>
                );
              })}
            </div>
          )}
          {Object.keys(sessionsByType).length>0&&(
            <div className="fitplan-stats-panel">
              <p className="fitplan-subheading">Répartition par type</p>
              <div className="fitplan-type-grid">
                {Object.entries(sessionsByType).map(([type,count])=>(
                  <div key={type} className="fitplan-type-card">
                    <p className="fitplan-stat-value">{count}</p>
                    <p className="fitplan-stat-label">{type}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {allSessions.length===0&&<p className="fitplan-empty">Ajoutez des séances pour voir vos stats</p>}
        </div>
      )}

      {/* Modale séance */}
      {modal==="session"&&(
        <div className="fitplan-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="fitplan-modal">
            <div className="fitplan-modal-header">
              <div>
                <p className="fitplan-modal-title">{editSession?.isNew?"Nouvelle séance":"Modifier la séance"}</p>
                <div className="fitplan-modal-meta">
                  <p className="fitplan-meta">{editSession?.dateKey}</p>
                  {editSession?.weekIdx!==undefined&&<span className="fitplan-badge" style={cssVars({"--badge-bg": WEEK_BG[editSession.weekIdx], "--badge-color": WEEK_COLORS[editSession.weekIdx]})}>{WEEK_LABELS[editSession.weekIdx]}</span>}
                </div>
              </div>
              <button onClick={()=>setModal(null)} className="fitplan-close-button">✕</button>
            </div>

            {/* Bilan semaine dans modale */}
            {editSession?.weekIdx!==undefined&&cycleStart&&(()=>{
              const wd=getWeekDates(cycleStart.getTime(),editSession.weekIdx);
              const ws=wd.map(d=>sessions[fmtFull(d)]).filter(Boolean);
              const hi=ws.filter(s=>["AMRAP","EMOM","For Time"].includes(s.type)).length;
              const st=ws.filter(s=>s.type==="Force").length;
              const en=ws.filter(s=>s.type==="Libre").length;
              const isDeload=editSession.weekIdx===3;
              const pills=isDeload?[{label:"Récup",val:ws.length,target:3,color:"#10b981",bg:"#ecfdf5"}]:[{label:"Intensité",val:hi,target:2,color:"#f97316",bg:"#fff7ed"},{label:"Force",val:st,target:3,color:"#8b5cf6",bg:"#f5f3ff"},{label:"Endurance",val:en,target:1,color:"#3b82f6",bg:"#eff6ff"}];
              return (
                <div className="fitplan-summary in-modal">
                  {pills.map(p=>(
                    <div key={p.label} className="fitplan-summary-item">
                      <p className="fitplan-summary-label">{p.label}</p>
                      <div className="fitplan-dots">
                        {Array.from({length:p.target}).map((_,i)=>(
                          <div key={i} className="fitplan-dot" style={cssVars({"--dot-bg": i<p.val?p.color:"var(--color-border-tertiary)", "--dot-border": i<p.val?p.color:"var(--color-border-secondary)"})}/>
                        ))}
                      </div>
                      <p className="fitplan-summary-count" style={cssVars({"--summary-color": p.val>=p.target?p.color:"var(--color-text-tertiary)", "--summary-weight": p.val>=p.target?500:400})}>{p.val}/{p.target}</p>
                    </div>
                  ))}
                  <div className="fitplan-summary-progress in-modal">
                    <p className="fitplan-summary-label">Volume</p>
                    <p className="fitplan-progress-value" style={cssVars({"--week-color": WEEK_COLORS[editSession.weekIdx]})}>{Math.round(PROGRESSION[editSession.weekIdx]*100)}%</p>
                  </div>
                </div>
              );
            })()}

            {/* Type */}
            <div className="fitplan-type-row">
              {WOD_TYPES.map(t=>(
                <button key={t} onClick={()=>setForm(f=>({...f,type:t}))} className={classNames("fitplan-type-button", form.type===t && "is-active")}>{t}</button>
              ))}
            </div>

            {/* Durée + Tours */}
            <div className="fitplan-form-grid">
              <div className="fitplan-field-card">
                <label className="fitplan-label fitplan-field-label">Durée</label>
                <div className="fitplan-control-row">
                  <input type="range" min={5} max={90} step={5} value={form.duration} onChange={e=>setForm(f=>({...f,duration:Number(e.target.value)}))} className="fitplan-range"/>
                  <span className="fitplan-duration-value">{form.duration} min</span>
                </div>
              </div>
              <div className="fitplan-field-card">
                <label className="fitplan-label fitplan-field-label">Nombre de tours</label>
                <div className="fitplan-control-row">
                  <button onClick={()=>setForm(f=>({...f,rounds:Math.max(1,(f.rounds||1)-1)}))} className="fitplan-step-button">−</button>
                  <span className="fitplan-rounds-value">{form.rounds||1}</span>
                  <button onClick={()=>setForm(f=>({...f,rounds:Math.min(20,(f.rounds||1)+1)}))} className="fitplan-step-button">+</button>
                </div>
              </div>
            </div>

            {/* Exercices */}
            <p className="fitplan-subheading">Exercices</p>
            {form.exercises.length>0&&(
              <div className="fitplan-exercise-list">
                {form.exercises.map((ex,i)=>(
                  <div key={i} className="fitplan-exercise-row">
                    <span className="fitplan-exercise-type" style={cssVars({"--chip-bg": TYPE_BG[ex.type], "--chip-color": TYPE_COLORS[ex.type]})}>{ex.type}</span>
                    <span className="fitplan-exercise-name">{ex.name}</span>
                    <span className="fitplan-exercise-meta">{ex.unit==="reps"?`${ex.reps}r`:`${ex.distance}m`} {ex.weight>0?`· ${ex.weight}kg`:""}</span>
                    <button onClick={()=>removeEx(i)} className="fitplan-icon-button">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Ajout exercice */}
            <div className="fitplan-exercise-picker">
              <div className="fitplan-filter-row">
                {(["Tous","WOD","Hyrox","Force"] as (ExerciseType | "Tous")[]).map(f=>(
                  <button key={f} onClick={()=>setExFilter(f)} className={classNames("fitplan-filter-button", exFilter===f && "is-active")}>{f}</button>
                ))}
              </div>
              <select value={tempEx||""} onChange={e=>setTempEx(e.target.value)} className="fitplan-select">
                <option value="">Choisir un exercice…</option>
                {availableEx.filter(e=>exFilter==="Tous"||e.type===exFilter).map(e=>(
                  <option key={e.name} value={e.name}>{e.name} ({e.type})</option>
                ))}
              </select>
              {tempEx&&(()=>{
                const ex=ALL_EXERCISES.find(e=>e.name===tempEx);
                return (
                  <div className="fitplan-exercise-controls">
                    {ex?.unit==="reps"?(<><label className="fitplan-label">Reps</label><input type="number" min={1} value={tempParams.reps} onChange={e=>setTempParams(p=>({...p,reps:Number(e.target.value)}))} className="fitplan-number-input is-reps"/></>):(<><label className="fitplan-label">Distance (m)</label><input type="number" min={0} step={10} value={tempParams.distance} onChange={e=>setTempParams(p=>({...p,distance:Number(e.target.value)}))} className="fitplan-number-input is-distance"/></>)}
                    <label className="fitplan-label">Poids (kg)</label>
                    <input type="number" min={0} step={2.5} value={tempParams.weight} onChange={e=>setTempParams(p=>({...p,weight:Number(e.target.value)}))} className="fitplan-number-input is-weight"/>
                    <button onClick={addExercise} className="fitplan-add-exercise-button">+ Ajouter</button>
                  </div>
                );
              })()}
            </div>

            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes libres…" className="fitplan-textarea"/>

            {genError&&<p className="fitplan-error">{genError}</p>}
            {generating&&<div className="fitplan-generating">✦ L'IA génère votre séance…</div>}

            <div className="fitplan-modal-actions">
              {editSession && !editSession.isNew&&<button onClick={()=>deleteSession(editSession.dateKey)} className="fitplan-delete-button">Supprimer</button>}
              <button onClick={generateSession} disabled={generating} className="fitplan-generate-button">
                {generating?"Génération…":"✦ Générer"}
              </button>
              <button onClick={saveSession} disabled={form.exercises.length===0} className="fitplan-save-button">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
