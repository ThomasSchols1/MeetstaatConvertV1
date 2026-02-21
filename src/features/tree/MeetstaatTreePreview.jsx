import React, { useMemo, useState } from "react";
import { normalizeStr } from "../../utils/format";

export default function MeetstaatTreePreview({
  effectiveRows,
  getVal,
  code1Source,
  descSource,
  qtySource,
  ecSource,
  hcSource,
  onCorrectMapping,
  onCorrectLevels,
  onNext,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  const model = useMemo(() => {
    const nodes = effectiveRows.map((it) => {
      const r = it.row;
      return {
        id: it._idx,
        type: it.type,
        level: it.level,
        code1: String(getVal(r, code1Source) ?? ""),
        desc: String(getVal(r, descSource) ?? ""),
        qty: String(getVal(r, qtySource) ?? ""),
        ec: String(getVal(r, ecSource) ?? ""),
        hc: String(getVal(r, hcSource) ?? ""),
      };
    });

    const children = new Map();
    const hasChildren = new Set();
    const stack = [];

    for (const n of nodes) children.set(n.id, []);

    for (const n of nodes) {
      while (stack.length && stack[stack.length - 1].level >= n.level) stack.pop();
      const parent = stack.length ? stack[stack.length - 1].id : null;
      if (parent != null) {
        children.get(parent).push(n.id);
        hasChildren.add(parent);
      }
      if (n.type === "H") stack.push({ id: n.id, level: n.level });
    }

    const rootIds = nodes.filter((n) => n.type === "H" && n.level === 0).map((n) => n.id);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return { rootIds, children, hasChildren, byId };
  }, [effectiveRows, getVal, code1Source, descSource, qtySource, ecSource, hcSource]);

  const visible = useMemo(() => {
    const out = [];
    const walk = (id, depthFromRoot) => {
      out.push({ id, depthFromRoot });
      const n = model.byId.get(id);
      if (!n) return;
      if (n.type === "H" && expanded.has(id)) {
        for (const childId of model.children.get(id) || []) walk(childId, depthFromRoot + 1);
      }
    };
    for (const rid of model.rootIds) walk(rid, 0);
    return out;
  }, [model, expanded]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const styles = {
    row: { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderBottom: "1px solid #eee" },
    code: { width: 140, flexShrink: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
    desc: { flex: 1 },
    meta: { width: 220, flexShrink: 0, color: "#666", fontSize: 12, display: "flex", gap: 10, justifyContent: "flex-end" },
    btn: { width: 24, height: 24, lineHeight: "22px", textAlign: "center", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", userSelect: "none" },
    spacer: (d) => ({ width: d * 18, flexShrink: 0 }),
    chapter: { color: "#0b5d1e", fontWeight: 700 },
    post: { color: "#111", fontWeight: 700 },
    text: { color: "#111", fontWeight: 400 },
  };

  const typeStyle = (t) => (t === "H" ? styles.chapter : t === "P" ? styles.post : styles.text);

  return (
    <div>
      <h3>Meetstaat preview (zoals Build)</h3>

      <div style={{ marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => setExpanded(new Set())}>Alles dicht</button>
        <button onClick={() => setExpanded(new Set(model.rootIds))}>Open level-0</button>
        <button onClick={onCorrectMapping}>Corrigeren mapping</button>
        <button onClick={onCorrectLevels}>Corrigeren levels/types</button>
        <button onClick={onNext}>Verder: Export</button>
      </div>

      {model.rootIds.length === 0 && (
        <div style={{ background: "#fff3cd", padding: 10, borderRadius: 6, marginBottom: 10 }}>
          <b>Opgelet:</b> Geen Level-0 hoofdstukken gevonden. Corrigeer types/levels of mapping.
        </div>
      )}

      <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        {visible.map(({ id, depthFromRoot }) => {
          const n = model.byId.get(id);
          if (!n) return null;

          const canToggle = n.type === "H" && model.hasChildren.has(id);
          const isOpen = expanded.has(id);

          return (
            <div key={id} style={styles.row}>
              <div style={styles.spacer(depthFromRoot)} />

              {canToggle ? (
                <div style={styles.btn} onClick={() => toggle(id)} title={isOpen ? "Inklappen" : "Uitklappen"}>
                  {isOpen ? "−" : "+"}
                </div>
              ) : (
                <div style={{ width: 24 }} />
              )}

              <div style={{ ...styles.code, ...typeStyle(n.type) }}>{n.code1}</div>
              <div style={{ ...styles.desc, ...typeStyle(n.type) }}>{n.desc}</div>

              <div style={styles.meta}>
                {n.type === "P" ? (
                  <>
                    <span>Aantal: {normalizeStr(n.qty) || "-"}</span>
                    <span>EC: {normalizeStr(n.ec) || "-"}</span>
                    <span>HC: {normalizeStr(n.hc) || "-"}</span>
                  </>
                ) : (
                  <span style={{ color: "#999" }}>Type {n.type} · Level {n.level}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
