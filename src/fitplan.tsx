import { useState, useEffect } from "react";

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

type StorageValue = {
  value: string;
};

type AppStorage = {
  get(key: string): Promise<StorageValue | null>;
  set(key: string, value: string): Promise<void>;
};

declare global {
  interface Window {
    storage?: AppStorage;
  }
}

const appStorage: AppStorage = {
  async get(key) {
    if (window.storage) return window.storage.get(key);
    const value = window.localStorage.getItem(key);
    return value === null ? null : { value };
  },
  async set(key, value) {
    if (window.storage) return window.storage.set(key, value);
    window.localStorage.setItem(key, value);
  },
};

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
      try { const s = await appStorage.get("fitplan:sessions"); if (s) setSessions(JSON.parse(s.value)); } catch {}
      try { const e = await appStorage.get("fitplan:equipment"); if (e) setEquipment(new Set(JSON.parse(e.value))); } catch {}
      try { const c = await appStorage.get("fitplan:customEquipment"); if (c) setCustomEquipment(new Set(JSON.parse(c.value))); } catch {}
      try { const cs = await appStorage.get("fitplan:cycleStart"); if (cs) { const d = new Date(JSON.parse(cs.value)); setCycleStart(d); setCycleInputVal(toInputDate(d)); } } catch {}
      setLoaded(true);
    }
    load();
  }, []);
  useEffect(() => { if (!loaded) return; appStorage.set("fitplan:sessions", JSON.stringify(sessions)).catch(()=>{}); }, [sessions, loaded]);
  useEffect(() => { if (!loaded) return; appStorage.set("fitplan:equipment", JSON.stringify([...equipment])).catch(()=>{}); }, [equipment, loaded]);
  useEffect(() => { if (!loaded) return; appStorage.set("fitplan:customEquipment", JSON.stringify([...customEquipment])).catch(()=>{}); }, [customEquipment, loaded]);
  useEffect(() => { if (!loaded || !cycleStart) return; appStorage.set("fitplan:cycleStart", JSON.stringify(cycleStart.getTime())).catch(()=>{}); }, [cycleStart, loaded]);

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

  if (!loaded) return <div style={{padding:"2rem",textAlign:"center",color:"var(--color-text-secondary)",fontSize:14}}>Chargement…</div>;

  // rendu d'une semaine (cycle ou planning)
  function renderWeek(weekIdx: number) {
    if (!cycleStart) return null;
    const dates = getWeekDates(cycleStart.getTime(), weekIdx);
    const isDeload = weekIdx === 3;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {dates.map((date,i) => {
          const key = fmtFull(date);
          const s = sessions[key];
          const isToday = fmtFull(new Date())===key;
          return (
            <div key={key} style={{display:"flex",alignItems:"stretch",gap:10}}>
              <div style={{width:44,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:isToday?"#f97316":isDeload?"#ecfdf5":"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"6px 0"}}>
                <p style={{margin:0,fontSize:11,color:isToday?"#fff":isDeload?"#059669":"var(--color-text-secondary)"}}>{DAYS[i]}</p>
                <p style={{margin:0,fontSize:16,fontWeight:500,color:isToday?"#fff":isDeload?"#059669":"var(--color-text-primary)"}}>{date.getDate()}</p>
              </div>
              {s ? (
                <div onClick={()=>openEdit(key,weekIdx)} style={{flex:1,background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12,fontWeight:500,padding:"2px 8px",borderRadius:20,background:"#fff7ed",color:"#c2410c"}}>{s.type}</span>
                      {s.duration&&<span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{s.duration} min</span>}
                      {s.rounds&&<span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{s.rounds} tours</span>}
                    </div>
                    <p style={{margin:"4px 0 0",fontSize:13,color:"var(--color-text-secondary)"}}>
                      {s.exercises.slice(0,3).map(e=>e.name).join(" · ")}{s.exercises.length>3?` +${s.exercises.length-3}`:""}
                    </p>
                  </div>
                  <span style={{fontSize:18,color:"var(--color-text-tertiary)"}}>›</span>
                </div>
              ) : (
                <button onClick={()=>openNew(key,weekIdx)} style={{flex:1,border:`0.5px dashed ${isDeload?"#6ee7b7":"var(--color-border-tertiary)"}`,borderRadius:"var(--border-radius-lg)",background:"transparent",color:isDeload?"#059669":"var(--color-text-tertiary)",fontSize:13,cursor:"pointer",textAlign:"left",padding:"0 14px"}}>
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
    <div style={{fontFamily:"var(--font-sans)",maxWidth:680,margin:"0 auto",padding:"0 0 2rem"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1.25rem 0 1rem"}}>
        <div>
          <p style={{margin:0,fontSize:22,fontWeight:500,color:"var(--color-text-primary)"}}>FitPlan</p>
          <p style={{margin:0,fontSize:13,color:"var(--color-text-secondary)"}}>CrossFit · Hyrox · Force</p>
        </div>
        <button onClick={()=>setShowEquip(v=>!v)} style={{fontSize:13,padding:"6px 12px",borderRadius:"var(--border-radius-md)"}}>
          {showEquip?"Fermer matériel":"Matériel"}
        </button>
      </div>

      {/* Panneau matériel */}
      {showEquip && (
        <div style={{background:"#ffffff",borderRadius:"var(--border-radius-lg)",padding:"1.25rem",marginBottom:"1rem",border:"1px solid rgba(0,0,0,0.1)",boxShadow:"0 4px 16px rgba(0,0,0,0.10)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,paddingBottom:12,borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
            <p style={{margin:0,fontWeight:500,fontSize:15,color:"var(--color-text-primary)"}}>Matériel disponible</p>
            <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{equipment.size} actif{equipment.size>1?"s":""}</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
            {[...customEquipment].map(eq => {
              const on = equipment.has(eq);
              const isCustom = !EQUIPMENT_LIST.includes(eq);
              return (
                <div key={eq} style={{display:"flex",alignItems:"center",borderRadius:20,border:`1px solid ${on?"#f97316":"var(--color-border-tertiary)"}`,background:on?"#fff7ed":"var(--color-background-secondary)",overflow:"hidden"}}>
                  <button onClick={()=>setEquipment(prev=>{const n=new Set(prev);on?n.delete(eq):n.add(eq);return n;})} style={{fontSize:12,padding:"5px 10px",background:"transparent",border:"none",color:on?"#c2410c":"var(--color-text-secondary)",cursor:"pointer"}}>{eq}</button>
                  {isCustom&&<button onClick={()=>{setCustomEquipment(prev=>{const n=new Set(prev);n.delete(eq);return n;});setEquipment(prev=>{const n=new Set(prev);n.delete(eq);return n;});}} style={{background:"transparent",border:"none",borderLeft:`1px solid ${on?"#f9731640":"var(--color-border-tertiary)"}`,padding:"5px 8px",cursor:"pointer",color:on?"#c2410c":"var(--color-text-tertiary)",fontSize:11}}>✕</button>}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input type="text" value={newEquipInput} onChange={e=>setNewEquipInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addCustomEquip();}} placeholder="Ajouter un équipement…" style={{flex:1,fontSize:13,borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-tertiary)",padding:"7px 12px",background:"var(--color-background-secondary)",color:"var(--color-text-primary)"}} />
            <button onClick={addCustomEquip} style={{padding:"7px 14px",fontSize:13,borderRadius:"var(--border-radius-md)",background:"#f97316",color:"#fff",border:"none",cursor:"pointer",fontWeight:500}}>+ Ajouter</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:"1.5rem",background:"var(--color-background-secondary)",padding:4,borderRadius:"var(--border-radius-lg)"}}>
        {([
          ["cycle","Cycle"],
          ["history","Historique"],
          ["stats","Stats"],
        ] as [Tab, string][]).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 0",fontSize:14,borderRadius:"var(--border-radius-md)",border:"none",background:tab===k?"var(--color-background-primary)":"transparent",fontWeight:tab===k?500:400,color:tab===k?"var(--color-text-primary)":"var(--color-text-secondary)",cursor:"pointer",boxShadow:tab===k?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>{l}</button>
        ))}
      </div>

      {/* Onglet Cycle */}
      {tab==="cycle" && (
        <div>
          {/* Configuration du cycle */}
          <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem",marginBottom:"1.25rem",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <p style={{margin:0,fontWeight:500,fontSize:15,color:"var(--color-text-primary)"}}>Cycle en cours</p>
              {currentCycleWeek!==null&&<span style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:WEEK_BG[currentCycleWeek],color:WEEK_COLORS[currentCycleWeek],fontWeight:500}}>{WEEK_LABELS[currentCycleWeek]}</span>}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16}}>
              <label style={{fontSize:13,color:"var(--color-text-secondary)",whiteSpace:"nowrap"}}>Début du cycle</label>
              <input type="date" value={cycleInputVal} onChange={e=>{setCycleInputVal(e.target.value);if(e.target.value){const d=fromInputDate(e.target.value);setCycleStart(d);}}} style={{flex:1,fontSize:13,borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-tertiary)",padding:"6px 10px"}} />
            </div>
            {/* Barre des 4 semaines */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              {WEEK_LABELS.map((_,i)=>{
                const isCurrent = currentCycleWeek===i;
                const isViewed = viewWeek===i;
                const wd = cycleStart ? getWeekDates(cycleStart.getTime(),i) : [];
                const count = wd.filter(d=>sessions[fmtFull(d)]).length;
                return (
                  <button key={i} onClick={()=>setViewWeek(i)} style={{padding:"10px 6px",borderRadius:"var(--border-radius-md)",border:`${isViewed?"2px":"1px"} solid ${isViewed?WEEK_COLORS[i]:"var(--color-border-tertiary)"}`,background:isCurrent?WEEK_BG[i]:"var(--color-background-secondary)",cursor:"pointer",textAlign:"center",position:"relative"}}>
                    {isCurrent&&<div style={{position:"absolute",top:5,right:5,width:6,height:6,borderRadius:"50%",background:WEEK_COLORS[i]}}/>}
                    <p style={{margin:"0 0 2px",fontSize:11,fontWeight:500,color:WEEK_COLORS[i]}}>S{i+1}</p>
                    <p style={{margin:"0 0 4px",fontSize:10,color:"var(--color-text-secondary)"}}>{i===3?"Deload":["Base","Prog.","Pic"][i]}</p>
                    <p style={{margin:0,fontSize:11,color:"var(--color-text-tertiary)"}}>{count}/7</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Semaine sélectionnée */}
          {cycleStart ? (
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <p style={{margin:"0 0 2px",fontSize:15,fontWeight:500,color:WEEK_COLORS[viewWeek]}}>{WEEK_LABELS[viewWeek]}</p>
                  <p style={{margin:0,fontSize:12,color:"var(--color-text-secondary)"}}>{WEEK_DESC[viewWeek]}</p>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setViewWeek(w=>Math.max(0,w-1))} disabled={viewWeek===0} style={{padding:"4px 10px",fontSize:13,opacity:viewWeek===0?0.4:1}}>←</button>
                  <button onClick={()=>setViewWeek(w=>Math.min(3,w+1))} disabled={viewWeek===3} style={{padding:"4px 10px",fontSize:13,opacity:viewWeek===3?0.4:1}}>→</button>
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
                  <div style={{display:"flex",gap:8,marginBottom:14,padding:"10px 12px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)"}}>
                    {pills.map(p=>(
                      <div key={p.label} style={{flex:1,textAlign:"center"}}>
                        <p style={{margin:"0 0 4px",fontSize:11,color:"var(--color-text-secondary)"}}>{p.label}</p>
                        <div style={{display:"flex",gap:3,justifyContent:"center"}}>
                          {Array.from({length:p.target}).map((_,i)=>(
                            <div key={i} style={{width:10,height:10,borderRadius:"50%",background:i<p.val?p.color:"var(--color-border-tertiary)",border:`1px solid ${i<p.val?p.color:"var(--color-border-secondary)"}`}}/>
                          ))}
                        </div>
                        <p style={{margin:"3px 0 0",fontSize:11,color:p.val>=p.target?p.color:"var(--color-text-tertiary)",fontWeight:p.val>=p.target?500:400}}>{p.val}/{p.target}</p>
                      </div>
                    ))}
                    <div style={{borderLeft:"0.5px solid var(--color-border-tertiary)",paddingLeft:12,textAlign:"center",minWidth:60}}>
                      <p style={{margin:"0 0 4px",fontSize:11,color:"var(--color-text-secondary)"}}>Progression</p>
                      <p style={{margin:0,fontSize:16,fontWeight:500,color:WEEK_COLORS[viewWeek]}}>{Math.round(PROGRESSION[viewWeek]*100)}%</p>
                    </div>
                  </div>
                );
              })()}
              {renderWeek(viewWeek)}
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"2rem",color:"var(--color-text-secondary)",fontSize:14}}>
              <p style={{margin:"0 0 8px"}}>Choisissez une date de début pour démarrer votre cycle.</p>
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      {tab==="history" && (
        <div>
          {allSessions.length===0 ? (
            <p style={{color:"var(--color-text-secondary)",fontSize:14,textAlign:"center",marginTop:"2rem"}}>Aucune séance enregistrée</p>
          ) : allSessions.map(s=>(
            <div key={s.date} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"14px 16px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:12,padding:"2px 8px",borderRadius:20,background:"#fff7ed",color:"#c2410c",fontWeight:500}}>{s.type}</span>
                  {s.duration&&<span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{s.duration} min</span>}
                  {s.rounds&&<span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{s.rounds} tours</span>}
                </div>
                <span style={{fontSize:13,color:"var(--color-text-secondary)"}}>{s.date}</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {s.exercises.map((e,i)=>(
                  <div key={i} style={{fontSize:12,padding:"3px 10px",borderRadius:16,border:`1px solid ${TYPE_COLORS[e.type]}30`,background:TYPE_BG[e.type],color:TYPE_COLORS[e.type]}}>
                    {e.name} {e.unit==="reps"?`${e.reps} reps`:e.unit==="m"?`${e.distance}m`:`${e.reps} cal`}
                    {e.weight>0&&` · ${e.weight}kg`}
                  </div>
                ))}
              </div>
              {s.notes&&<p style={{margin:"8px 0 0",fontSize:12,color:"var(--color-text-secondary)",fontStyle:"italic"}}>{s.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {tab==="stats" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:"1.5rem"}}>
            {[["Séances",allSessions.length],["Exercices",Object.keys(exCount).length],["Cycle",currentCycleWeek!==null?`S${currentCycleWeek+1}/4`:"—"]].map(([l,v])=>(
              <div key={l} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"12px 14px"}}>
                <p style={{margin:"0 0 4px",fontSize:12,color:"var(--color-text-secondary)"}}>{l}</p>
                <p style={{margin:0,fontSize:24,fontWeight:500,color:"var(--color-text-primary)"}}>{v}</p>
              </div>
            ))}
          </div>
          {topEx.length>0&&(
            <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"16px",marginBottom:"1.5rem"}}>
              <p style={{margin:"0 0 14px",fontSize:14,fontWeight:500,color:"var(--color-text-primary)"}}>Exercices les plus pratiqués</p>
              {topEx.map(([name,count])=>{
                const ex=ALL_EXERCISES.find(e=>e.name===name);
                return (
                  <div key={name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{fontSize:12,padding:"2px 8px",borderRadius:12,background:ex?TYPE_BG[ex.type]:"#f3f4f6",color:ex?TYPE_COLORS[ex.type]:"#6b7280",minWidth:48,textAlign:"center"}}>{ex?.type}</span>
                    <span style={{flex:1,fontSize:13,color:"var(--color-text-primary)"}}>{name}</span>
                    <div style={{width:80,height:6,background:"var(--color-background-secondary)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:`${Math.round((count/topEx[0][1])*100)}%`,height:"100%",background:"#f97316",borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:12,color:"var(--color-text-secondary)",minWidth:20,textAlign:"right"}}>{count}x</span>
                  </div>
                );
              })}
            </div>
          )}
          {Object.keys(sessionsByType).length>0&&(
            <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"16px"}}>
              <p style={{margin:"0 0 14px",fontSize:14,fontWeight:500,color:"var(--color-text-primary)"}}>Répartition par type</p>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {Object.entries(sessionsByType).map(([type,count])=>(
                  <div key={type} style={{flex:"1 1 100px",textAlign:"center",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"12px 8px"}}>
                    <p style={{margin:0,fontSize:20,fontWeight:500,color:"var(--color-text-primary)"}}>{count}</p>
                    <p style={{margin:"2px 0 0",fontSize:12,color:"var(--color-text-secondary)"}}>{type}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {allSessions.length===0&&<p style={{color:"var(--color-text-secondary)",fontSize:14,textAlign:"center",marginTop:"2rem"}}>Ajoutez des séances pour voir vos stats</p>}
        </div>
      )}

      {/* Modale séance */}
      {modal==="session"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:"1rem"}} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div style={{background:"#ffffff",borderRadius:"var(--border-radius-xl)",padding:"1.5rem",width:"100%",maxWidth:560,maxHeight:"85vh",overflowY:"auto",boxSizing:"border-box",border:"1px solid rgba(0,0,0,0.1)",boxShadow:"0 8px 32px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.10)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,paddingBottom:16,borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
              <div>
                <p style={{margin:"0 0 2px",fontWeight:500,fontSize:17,color:"var(--color-text-primary)"}}>{editSession?.isNew?"Nouvelle séance":"Modifier la séance"}</p>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <p style={{margin:0,fontSize:13,color:"var(--color-text-secondary)"}}>{editSession?.dateKey}</p>
                  {editSession?.weekIdx!==undefined&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:WEEK_BG[editSession.weekIdx],color:WEEK_COLORS[editSession.weekIdx],fontWeight:500}}>{WEEK_LABELS[editSession.weekIdx]}</span>}
                </div>
              </div>
              <button onClick={()=>setModal(null)} style={{background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,cursor:"pointer",color:"var(--color-text-secondary)",flexShrink:0}}>✕</button>
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
                <div style={{display:"flex",gap:8,marginBottom:16,padding:"10px 12px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)"}}>
                  {pills.map(p=>(
                    <div key={p.label} style={{flex:1,textAlign:"center"}}>
                      <p style={{margin:"0 0 4px",fontSize:11,color:"var(--color-text-secondary)"}}>{p.label}</p>
                      <div style={{display:"flex",gap:3,justifyContent:"center"}}>
                        {Array.from({length:p.target}).map((_,i)=>(
                          <div key={i} style={{width:10,height:10,borderRadius:"50%",background:i<p.val?p.color:"var(--color-border-tertiary)",border:`1px solid ${i<p.val?p.color:"var(--color-border-secondary)"}`}}/>
                        ))}
                      </div>
                      <p style={{margin:"3px 0 0",fontSize:11,color:p.val>=p.target?p.color:"var(--color-text-tertiary)",fontWeight:p.val>=p.target?500:400}}>{p.val}/{p.target}</p>
                    </div>
                  ))}
                  <div style={{borderLeft:"0.5px solid var(--color-border-tertiary)",paddingLeft:12,textAlign:"center",minWidth:56}}>
                    <p style={{margin:"0 0 4px",fontSize:11,color:"var(--color-text-secondary)"}}>Volume</p>
                    <p style={{margin:0,fontSize:16,fontWeight:500,color:WEEK_COLORS[editSession.weekIdx]}}>{Math.round(PROGRESSION[editSession.weekIdx]*100)}%</p>
                  </div>
                </div>
              );
            })()}

            {/* Type */}
            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              {WOD_TYPES.map(t=>(
                <button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={{padding:"6px 14px",borderRadius:20,fontSize:13,border:`1px solid ${form.type===t?"#f97316":"var(--color-border-tertiary)"}`,background:form.type===t?"#fff7ed":"transparent",color:form.type===t?"#c2410c":"var(--color-text-secondary)",cursor:"pointer"}}>{t}</button>
              ))}
            </div>

            {/* Durée + Tours */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 14px"}}>
                <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:6}}>Durée</label>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="range" min={5} max={90} step={5} value={form.duration} onChange={e=>setForm(f=>({...f,duration:Number(e.target.value)}))} style={{flex:1}}/>
                  <span style={{fontSize:14,fontWeight:500,minWidth:42,color:"var(--color-text-primary)"}}>{form.duration} min</span>
                </div>
              </div>
              <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 14px"}}>
                <label style={{fontSize:12,color:"var(--color-text-secondary)",display:"block",marginBottom:6}}>Nombre de tours</label>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <button onClick={()=>setForm(f=>({...f,rounds:Math.max(1,(f.rounds||1)-1)}))} style={{width:28,height:28,borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-tertiary)",background:"var(--color-background-primary)",fontSize:16,cursor:"pointer",color:"var(--color-text-primary)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>−</button>
                  <span style={{flex:1,textAlign:"center",fontSize:18,fontWeight:500,color:"var(--color-text-primary)"}}>{form.rounds||1}</span>
                  <button onClick={()=>setForm(f=>({...f,rounds:Math.min(20,(f.rounds||1)+1)}))} style={{width:28,height:28,borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-tertiary)",background:"var(--color-background-primary)",fontSize:16,cursor:"pointer",color:"var(--color-text-primary)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+</button>
                </div>
              </div>
            </div>

            {/* Exercices */}
            <p style={{margin:"0 0 8px",fontSize:13,fontWeight:500,color:"var(--color-text-primary)"}}>Exercices</p>
            {form.exercises.length>0&&(
              <div style={{marginBottom:12,display:"flex",flexDirection:"column",gap:6}}>
                {form.exercises.map((ex,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)"}}>
                    <span style={{fontSize:12,padding:"2px 6px",borderRadius:10,background:TYPE_BG[ex.type],color:TYPE_COLORS[ex.type]}}>{ex.type}</span>
                    <span style={{flex:1,fontSize:13,color:"var(--color-text-primary)"}}>{ex.name}</span>
                    <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{ex.unit==="reps"?`${ex.reps}r`:`${ex.distance}m`} {ex.weight>0?`· ${ex.weight}kg`:""}</span>
                    <button onClick={()=>removeEx(i)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-tertiary)",fontSize:14}}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Ajout exercice */}
            <div style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:12,marginBottom:14}}>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                {(["Tous","WOD","Hyrox","Force"] as (ExerciseType | "Tous")[]).map(f=>(
                  <button key={f} onClick={()=>setExFilter(f)} style={{fontSize:12,padding:"3px 8px",borderRadius:12,border:`1px solid ${exFilter===f?"#f97316":"var(--color-border-tertiary)"}`,background:exFilter===f?"#fff7ed":"transparent",color:exFilter===f?"#c2410c":"var(--color-text-secondary)",cursor:"pointer"}}>{f}</button>
                ))}
              </div>
              <select value={tempEx||""} onChange={e=>setTempEx(e.target.value)} style={{width:"100%",marginBottom:10,fontSize:13}}>
                <option value="">Choisir un exercice…</option>
                {availableEx.filter(e=>exFilter==="Tous"||e.type===exFilter).map(e=>(
                  <option key={e.name} value={e.name}>{e.name} ({e.type})</option>
                ))}
              </select>
              {tempEx&&(()=>{
                const ex=ALL_EXERCISES.find(e=>e.name===tempEx);
                return (
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    {ex?.unit==="reps"?(<><label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Reps</label><input type="number" min={1} value={tempParams.reps} onChange={e=>setTempParams(p=>({...p,reps:Number(e.target.value)}))} style={{width:60,fontSize:13}}/></>):(<><label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Distance (m)</label><input type="number" min={0} step={10} value={tempParams.distance} onChange={e=>setTempParams(p=>({...p,distance:Number(e.target.value)}))} style={{width:80,fontSize:13}}/></>)}
                    <label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Poids (kg)</label>
                    <input type="number" min={0} step={2.5} value={tempParams.weight} onChange={e=>setTempParams(p=>({...p,weight:Number(e.target.value)}))} style={{width:70,fontSize:13}}/>
                    <button onClick={addExercise} style={{marginLeft:"auto",fontSize:13,padding:"5px 12px"}}>+ Ajouter</button>
                  </div>
                );
              })()}
            </div>

            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes libres…" style={{width:"100%",fontSize:13,borderRadius:"var(--border-radius-md)",border:"0.5px solid var(--color-border-tertiary)",padding:10,minHeight:56,boxSizing:"border-box",resize:"vertical",color:"var(--color-text-primary)",background:"var(--color-background-primary)"}}/>

            {genError&&<p style={{fontSize:12,color:"#dc2626",margin:"8px 0 0"}}>{genError}</p>}
            {generating&&<div style={{fontSize:13,color:"var(--color-text-secondary)",padding:"10px 0",textAlign:"center"}}>✦ L'IA génère votre séance…</div>}

            <div style={{display:"flex",gap:10,marginTop:20,paddingTop:16,borderTop:"0.5px solid var(--color-border-tertiary)"}}>
              {editSession && !editSession.isNew&&<button onClick={()=>deleteSession(editSession.dateKey)} style={{padding:"8px 16px",fontSize:13,color:"#dc2626",borderColor:"#fca5a5"}}>Supprimer</button>}
              <button onClick={generateSession} disabled={generating} style={{padding:"10px 14px",fontSize:13,fontWeight:500,background:"var(--color-background-secondary)",color:"var(--color-text-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:generating?"default":"pointer",whiteSpace:"nowrap"}}>
                {generating?"Génération…":"✦ Générer"}
              </button>
              <button onClick={saveSession} disabled={form.exercises.length===0} style={{flex:1,padding:"10px 0",fontSize:14,fontWeight:500,background:form.exercises.length===0?"var(--color-background-secondary)":"#f97316",color:form.exercises.length===0?"var(--color-text-tertiary)":"#fff",border:"none",borderRadius:"var(--border-radius-md)",cursor:form.exercises.length===0?"default":"pointer"}}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
