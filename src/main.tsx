import { Fragment, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { ArrowDown, ArrowRight, Check, ClipboardList, FileText, Layers, Play, RotateCcw, Sparkles } from "lucide-react";
import { diffScreens, projectSchema, questionsSchema, sampleBrief, sampleProject, sampleRevision, type Project, type Screen } from "../lib/project";
import "./style.css";

type Stage = "Brief" | "User flow" | "Preview";
type Source = "sample" | "ai";
type Workspace = { project: Project; draft?: Project; source: Source };
const initial: Workspace = { project: sampleProject, draft: sampleRevision, source: "sample" };
const stages: Stage[] = ["Brief", "User flow", "Preview"];

function restore(): Workspace {
  try {
    const saved = JSON.parse(localStorage.getItem("brief-to-prototype.v1") ?? "null");
    if (saved && (saved.source === "sample" || saved.source === "ai")) {
      const project = projectSchema.parse(saved.project);
      const draft = saved.draft ? projectSchema.parse(saved.draft) : undefined;
      return { project, draft, source: saved.source };
    }
  } catch {
    // The sample works even when browser storage is unavailable.
  }
  return initial;
}

async function request(body: object) {
  const response = await fetch("/api/assist", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Couldn’t complete the request.");
  return result;
}

function mainPath(screens: Screen[]) {
  const byId = new Map(screens.map((screen) => [screen.id, screen]));
  const path: Screen[] = [];
  const seen = new Set<string>();
  let current: Screen | undefined = screens[0];
  while (current && !seen.has(current.id)) {
    if (path.length > 0 && current.actions.length > 0 && current.actions.every(({ target }) => seen.has(target))) break;
    path.push(current);
    seen.add(current.id);
    current = byId.get(current.actions[0]?.target);
  }
  return path;
}

function App() {
  const [workspace, setWorkspace] = useState(restore);
  const [stage, setStage] = useState<Stage>("User flow");
  const [selected, setSelected] = useState(() => workspace.draft?.requirements.at(-1)?.id ?? workspace.project.requirements[0].id);
  const [brief, setBrief] = useState(sampleBrief);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [proposal, setProposal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [highlight, setHighlight] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const { project, draft, source } = workspace;
  const candidate = draft ?? project;
  const requirements = candidate.requirements;
  const activeRequirement = requirements.find(({ id }) => id === selected) ?? requirements[0];
  const changes = draft ? diffScreens(project, draft) : [];
  const path = mainPath(candidate.screens);
  const branches = candidate.screens.filter(({ id }) => !path.some((screen) => screen.id === id));

  useEffect(() => {
    try { localStorage.setItem("brief-to-prototype.v1", JSON.stringify(workspace)); } catch {}
  }, [workspace]);

  useEffect(() => {
    if (!highlight.length) return;
    const timer = window.setTimeout(() => setHighlight([]), 850);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  async function task(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong. Try again.");
    } finally { setBusy(false); }
  }

  function reset() {
    setWorkspace(initial);
    setStage("User flow");
    setSelected("reschedule");
    setError("");
    setNotice("");
    setProposal("");
    setEditing(false);
  }

  function apply() {
    if (!draft) return;
    setHighlight(changes.map(({ id }) => id));
    setWorkspace({ ...workspace, project: draft, draft: undefined });
    setNotice("Changes applied. Your prototype is ready to preview.");
  }

  function editRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const edited = {
      ...activeRequirement,
      title: String(data.get("title")).trim(),
      detail: String(data.get("detail")).trim(),
    };
    const result = projectSchema.safeParse({
      ...candidate,
      requirements: requirements.map((requirement) => requirement.id === edited.id ? edited : requirement),
    });
    if (!result.success) { setError("Enter a title and a description."); return; }
    setError("");
    setWorkspace({ ...workspace, draft: result.data });
    setEditing(false);
    setNotice("Requirement saved as a draft. Review the affected screens before applying.");
  }

  return (
    <>
      <header className="top">
        <div className="brand"><span className="brand-icon"><Layers size={21}/></span>Brief to Prototype</div>
        <nav aria-label="Workflow">
          {stages.map((name) => <button key={name} aria-current={stage === name ? "step" : undefined} onClick={() => { setStage(name); setError(""); }} disabled={busy}>{name}</button>)}
        </nav>
        <button className="quiet reset" onClick={reset} disabled={busy}><RotateCcw size={16}/> Reset sample</button>
      </header>
      <main className="wrap">
        <header className="project-head">
          <div><p className="source"><span/>{source === "sample" ? "Sample project" : "AI-assisted project"}</p><h1>{stage === "Brief" ? "Your product brief" : project.title}</h1></div>
          {stage === "User flow" && <button className="secondary" onClick={() => setStage("Preview")} disabled={busy}><Play size={16}/> Preview prototype</button>}
        </header>
        <div className="messages" aria-live="polite">{notice && <p><Check size={17}/> {notice}</p>}</div>
        {error && <p className="error" role="alert">{error}</p>}
        {stage === "Brief" && <section className="panel brief">
          <div className="section-title"><span className="small-icon lilac"><FileText size={19}/></span><div><h2>Describe your idea</h2><p>AI turns your brief and answers into a flow you can test.</p></div></div>
          <label htmlFor="product-brief">Product brief</label>
          <textarea id="product-brief" rows={5} maxLength={4000} value={brief} disabled={busy} onChange={(event) => { setBrief(event.target.value); setQuestions([]); setAnswers({}); }}/>
          {questions.map((question, index) => <label key={index}>{question}<input maxLength={600} value={answers[question] ?? ""} disabled={busy} onChange={(event) => setAnswers({ ...answers, [question]: event.target.value })}/></label>)}
          <div className="button-row">
            <button className="secondary" disabled={busy || brief.trim().length < 10} onClick={() => void task(async () => {
              const result = questionsSchema.parse(await request({ task: "clarify", brief }));
              setQuestions(result.questions);
            })}><Sparkles size={16}/> Ask clarifying questions</button>
            <button className="primary" disabled={busy || brief.trim().length < 10} onClick={() => void task(async () => {
              const next = projectSchema.parse(await request({ task: "plan", brief, answers: questions.map((question) => ({ question, answer: answers[question] ?? "" })) }));
              setWorkspace({ project: next, source: "ai" });
              setSelected(next.requirements[0].id);
              setEditing(false);
              setProposal("");
              setStage("User flow");
            })}><Sparkles size={16}/> Generate flow</button>
            {busy && <span role="status">Working…</span>}
          </div>
        </section>}
        {stage === "User flow" && <div className="workspace">
          <section className="panel requirements" aria-labelledby="requirements">
            <h2 id="requirements">Requirements</h2>
            <ul>{requirements.map((requirement) => <li key={requirement.id}><button disabled={busy} aria-pressed={requirement.id === activeRequirement.id} onClick={() => { setSelected(requirement.id); setEditing(false); }}><span className="selection">{requirement.id === activeRequirement.id && <Check size={14}/>}</span>{requirement.title}</button></li>)}</ul>
            {editing ? <form className="edit-form" key={activeRequirement.id} onSubmit={editRequirement}>
              <label>Title<input name="title" required maxLength={70} defaultValue={activeRequirement.title}/></label>
              <label>Description<textarea name="detail" required maxLength={240} rows={3} defaultValue={activeRequirement.detail}/></label>
              <div className="button-row"><button className="primary" disabled={busy}>Save draft</button><button className="quiet" type="button" onClick={() => setEditing(false)}>Cancel</button></div>
            </form> : <div className="requirement-info"><p>{activeRequirement.detail}</p><button className="quiet" disabled={busy} onClick={() => setEditing(true)}>Edit requirement</button></div>}
          </section>
          <section className="panel flow" aria-labelledby="flow-title">
            <div className="flow-head"><h2 id="flow-title">{source === "sample" ? "Booking flow" : "User flow"}</h2><span>{candidate.screens.length} screens</span></div>
            <div className="canvas">
              <div className="path">
                {path.map((screen, index) => <Fragment key={screen.id}>{index > 0 && <ArrowRight className="connector" size={20} aria-label="then"/>}<FlowNode screen={screen} active={screen.requirementIds.includes(activeRequirement.id)} changed={highlight.includes(screen.id)} onSelect={() => { setSelected(screen.requirementIds[0]); setEditing(false); }} /></Fragment>)}
              </div>
              {branches.length > 0 && <div className="branches">
                {branches.map((screen) => {
                  const parent = candidate.screens.find((entry) => entry.actions.some(({ target }) => target === screen.id));
                  const proposed = !project.screens.some(({ id }) => id === screen.id);
                  return <div key={screen.id} className={`branch ${proposed ? "new" : ""}`}>
                    <span className="branch-line" aria-hidden="true"><ArrowDown size={16}/></span>
                    {parent && <small>From {parent.title}</small>}
                    <FlowNode screen={screen} proposed={proposed} active={screen.requirementIds.includes(activeRequirement.id)} changed={highlight.includes(screen.id)} onSelect={() => { setSelected(screen.requirementIds.at(-1)!); setEditing(false); }}/>
                  </div>;
                })}
              </div>}
            </div>
          </section>
          <section className="panel impact" aria-labelledby="impact-title">
            <h2 id="impact-title">Change impact</h2>
            {draft ? <>
              <p className="impact-count">{changes.length ? `${changes.length} ${changes.length === 1 ? "screen" : "screens"} affected` : "No screen changes"}</p>
              <ul>{changes.map((change) => <li className={change.kind === "Added" ? "added" : ""} key={change.id}><span>{change.title}</span><small>{change.kind}</small></li>)}</ul>
              <div className="impact-buttons"><button className="primary" onClick={apply} disabled={busy}>Apply changes</button><button className="quiet" disabled={busy} onClick={() => { setWorkspace({ ...workspace, draft: undefined }); setEditing(false); setNotice("Draft discarded."); }}>Discard draft</button></div>
            </> : <p className="impact-count">No pending changes.</p>}
            <form className="proposal" onSubmit={(event) => {
              event.preventDefault();
              void task(async () => {
                const next = projectSchema.parse(await request({ task: "revise", project: candidate, change: proposal }));
                setWorkspace({ ...workspace, draft: next });
                setProposal("");
                setNotice("Draft ready. Review the screen changes before applying.");
              });
            }}>
              <label>Propose a change<textarea rows={2} value={proposal} maxLength={1000} onChange={(event) => setProposal(event.target.value)} placeholder="e.g. Let customers choose a stylist" disabled={busy}/></label>
              <button className="secondary" disabled={busy || proposal.trim().length < 3}><Sparkles size={15}/> {busy ? "Drafting…" : "Draft with AI"}</button>
            </form>
          </section>
        </div>}
        {stage === "Preview" && <Prototype project={project} source={source} pending={Boolean(draft)} />}
      </main>
    </>
  );
}

function FlowNode({ screen, active, changed, proposed, onSelect }: { screen: Screen; active: boolean; changed: boolean; proposed?: boolean; onSelect: () => void }) {
  return <button className={`node${proposed ? " proposed" : ""}${changed ? " flashed" : ""}`} aria-pressed={active} onClick={onSelect}><span>{screen.title}</span>{proposed && <small>Draft</small>}</button>;
}

function Prototype({ project, source, pending }: { project: Project; source: Source; pending: boolean }) {
  const [trail, setTrail] = useState<string[]>([project.screens[0].id]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmedTime, setConfirmedTime] = useState("");
  const current = project.screens.find(({ id }) => id === trail.at(-1)) ?? project.screens[0];
  const linked = project.requirements.filter(({ id }) => current.requirementIds.includes(id));
  const chosen = values[current.id] ?? "";
  return <section className="preview">
    <div className="panel preview-panel">
      <div className="preview-head"><div className="section-title"><span className="small-icon lilac"><Play size={18}/></span><div><h2>Interactive prototype</h2><p>{pending ? "Previewing the applied flow. A draft is pending." : "Try the flow as a user."}</p></div></div>
      <button className="quiet" onClick={() => { setTrail([project.screens[0].id]); setValues({}); setConfirmedTime(""); }}><RotateCcw size={16}/> Restart</button></div>
      <div className="prototype-screen" key={current.id}>
        <h3>{current.title}</h3><p>{current.detail}</p>
        {source === "sample" && current.id === "confirm" && <dl><div><dt>Service</dt><dd>{values.service ?? "—"}</dd></div><div><dt>Time</dt><dd>{confirmedTime || "—"}</dd></div></dl>}
        {current.options.length > 0 && <fieldset><legend>Choose one option</legend>{current.options.map((option, index) => <label key={index}><input type="radio" name="selection" value={option} checked={chosen === option} onChange={() => setValues({ ...values, [current.id]: option })}/>{option}</label>)}</fieldset>}
        <div className="button-row">
          {trail.length > 1 && <button className="secondary" onClick={() => setTrail(trail.slice(0, -1))}>Back</button>}
          {current.actions.map((action, index) => <button key={index} className="primary" disabled={current.options.length > 0 && !chosen} onClick={() => {
            if (source === "sample" && action.target === "confirm") setConfirmedTime(chosen);
            setTrail([...trail, action.target]);
          }}>{action.label}<ArrowRight size={16}/></button>)}
        </div>
      </div>
    </div>
    <aside className="panel trace"><div className="section-title"><span className="small-icon mint"><ClipboardList size={18}/></span><h2>Linked requirements</h2></div><ul>{linked.map((requirement) => <li key={requirement.id}><strong>{requirement.title}</strong><p>{requirement.detail}</p></li>)}</ul></aside>
  </section>;
}

createRoot(document.getElementById("root")!).render(<App />);
