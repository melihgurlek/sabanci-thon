"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Activity,
  Users,
  TrendingUp,
  Search,
  Info,
  Loader2,
  BarChart2,
  GitBranch,
  MousePointer2,
  Minus,
  Circle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  Dna,
  Brain,
  Network,
  FlaskConical,
  ShieldCheck,
  Stethoscope,
  FileInput,
  FileOutput
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

/* ─────────────────────────── Animated SVG Gauge ─────────────────────────── */
const Gauge = ({ value, color, label, sublabel }) => {
  const pct = Math.min(Math.max(Math.round(value * 100), 0), 100);
  const r = 68;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const riskLabel = pct >= 70 ? 'HIGH RISK' : pct >= 40 ? 'MODERATE' : 'LOW RISK';
  const riskColor = pct >= 70 ? '#ff4b4b' : pct >= 40 ? '#f59e0b' : '#22d3ee';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: 180, height: 180 }}>
        <svg style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
          <circle cx="90" cy="90" r={r} stroke="#1e293b" strokeWidth="14" fill="transparent" />
          <circle
            cx="90" cy="90" r={r} stroke={color} strokeWidth="14" fill="transparent"
            strokeDasharray={circ}
            style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
            strokeLinecap="round"
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2
        }}>
          <span style={{ fontSize: 32, fontWeight: 700, color }}>{pct}%</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: riskColor, letterSpacing: 1 }}>{riskLabel}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f2f5' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{sublabel}</div>
      </div>
    </div>
  );
};

/* ─────────────────────────── Custom Tooltip ─────────────────────────── */
const CustomBarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 14px', fontSize: 13
    }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{payload[0]?.payload?.feature}</div>
      <div style={{ color: '#22d3ee', fontWeight: 700 }}>
        Importance: {(payload[0]?.value || 0).toFixed(4)}
      </div>
    </div>
  );
};

/* ─────────────────────────── Main Dashboard ─────────────────────────── */
const TUMOR_SITES = ['All', 'Oral Cavity', 'Oropharynx', 'Hypopharynx', 'Larynx', 'Other'];
const GRADINGS = ['All', 'G1 (Well)', 'G2 (Moderate)', 'G3 (Poor)', 'G4 (Undiff)'];
const PT_STAGES = ['All', '1', '2', '3', '4'];

export default function Dashboard() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');  // 'overview' | 'features' | 'twins'
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [graphClickBanner, setGraphClickBanner] = useState(null); // { id, label }
  const fgRef = useRef();

  // ── Filter state ──
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterGender, setFilterGender] = useState('All');    // 'All' | 'Male' | 'Female'
  const [filterSmoking, setFilterSmoking] = useState('All');    // 'All' | 'Never' | 'Former' | 'Current' | 'Unknown'
  const [filterRecurrence, setFilterRecurrence] = useState('All');    // 'All' | 'yes' | 'no'
  const [filterSurvival, setFilterSurvival] = useState('All');    // 'All' | 'living' | 'dead'
  const [filterTumorSite, setFilterTumorSite] = useState('All');
  const [filterGrading, setFilterGrading] = useState('All');
  const [filterPT, setFilterPT] = useState('All');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');

  const activeFilterCount = [
    filterGender !== 'All', filterSmoking !== 'All', filterRecurrence !== 'All',
    filterSurvival !== 'All', filterTumorSite !== 'All', filterGrading !== 'All',
    filterPT !== 'All', filterAgeMin !== '', filterAgeMax !== ''
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFilterGender('All'); setFilterSmoking('All'); setFilterRecurrence('All');
    setFilterSurvival('All'); setFilterTumorSite('All'); setFilterGrading('All');
    setFilterPT('All'); setFilterAgeMin(''); setFilterAgeMax('');
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/patients`)
      .then(r => r.json())
      .then(d => {
        setPatients(d.patients || []);
        if (d.patients?.length > 0) handleSelectPatient(d.patients[0].id);
      })
      .catch(() => { });
  }, []);

  const handleSelectPatient = (id) => {
    setSelectedPatient(id);
    setLoading(true);
    setGraphClickBanner(null);
    fetch(`${API_BASE}/api/predict/${id}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.graph) {
          // Normalise edge weights for rendering
          const weights = (d.graph.links || []).map(l => l.value);
          const maxW = Math.max(...weights, 0.0001);
          const links = (d.graph.links || []).map(l => ({ ...l, normValue: l.value / maxW }));
          setGraphData({ nodes: d.graph.nodes || [], links });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleNodeClick = useCallback((node) => {
    // Ignore the current target node
    if (node.type === 'target') return;

    // Show a brief banner, then fire a full patient selection
    setGraphClickBanner({ id: node.id, label: node.label });
    setTimeout(() => setGraphClickBanner(null), 2500);

    // Scroll sidebar item into view if possible
    handleSelectPatient(node.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nodeColor = useCallback((node) => {
    if (node.id === selectedPatient || node.type === 'target') return '#ff4b4b';
    return node.survival === 'living' ? '#00d4ff' : '#94a3b8';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient]);

  const filteredPatients = (patients || []).filter(p => {
    if (!String(p.id).toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterGender !== 'All') {
      const isFemale = p.sex === 1;
      if (filterGender === 'Female' && !isFemale) return false;
      if (filterGender === 'Male' && isFemale) return false;
    }
    if (filterSmoking !== 'All' && p.smoking !== filterSmoking) return false;
    if (filterRecurrence !== 'All' && String(p.recurrence).toLowerCase() !== filterRecurrence) return false;
    if (filterSurvival === 'living' && String(p.survival_status).toLowerCase() !== 'living') return false;
    if (filterSurvival === 'dead' && String(p.survival_status).toLowerCase() === 'living') return false;
    if (filterTumorSite !== 'All' && p.tumor_site !== filterTumorSite) return false;
    if (filterGrading !== 'All' && p.grading !== filterGrading) return false;
    if (filterPT !== 'All' && String(p.pT_stage) !== filterPT) return false;
    if (filterAgeMin !== '' && p.age < Number(filterAgeMin)) return false;
    if (filterAgeMax !== '' && p.age > Number(filterAgeMax)) return false;
    return true;
  });

  const tabs = [
    { id: 'overview', label: 'Risk Overview', icon: <Activity size={14} /> },
    { id: 'features', label: 'Feature Importance', icon: <BarChart2 size={14} /> },
    { id: 'twins', label: 'Clinical Twin Map', icon: <GitBranch size={14} /> },
    { id: 'about', label: 'About', icon: <BookOpen size={14} /> },
  ];

  return (
    <div className="dashboard">
      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Activity size={22} color="#22d3ee" />
          <span style={{ fontSize: 17, fontWeight: 700 }}>Patient Console</span>
        </div>

        {/* Search */}
        <div className="search-box">
          <Search size={15} color="#64748b" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search patient ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingRight: 36 }}
          />
          {searchTerm && (
            <button className="search-clear" onClick={() => setSearchTerm('')}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          className={`filter-toggle${filtersOpen ? ' filter-toggle-open' : ''}`}
          onClick={() => setFiltersOpen(v => !v)}
        >
          <SlidersHorizontal size={13} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="filter-badge">{activeFilterCount}</span>
          )}
          <span style={{ marginLeft: 'auto' }}>
            {filtersOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="filter-panel">

            {/* Age range */}
            <div className="filter-group">
              <div className="filter-label">Age Range</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="filter-num"
                  type="number"
                  placeholder="Min"
                  value={filterAgeMin}
                  onChange={e => setFilterAgeMin(e.target.value)}
                />
                <input
                  className="filter-num"
                  type="number"
                  placeholder="Max"
                  value={filterAgeMax}
                  onChange={e => setFilterAgeMax(e.target.value)}
                />
              </div>
            </div>

            {/* Gender */}
            <div className="filter-group">
              <div className="filter-label">Gender</div>
              <div className="chip-row">
                {['All', 'Male', 'Female'].map(v => (
                  <button key={v} className={`chip${filterGender === v ? ' chip-active' : ''}`} onClick={() => setFilterGender(v)}>{v}</button>
                ))}
              </div>
            </div>

            {/* Smoking */}
            <div className="filter-group">
              <div className="filter-label">Smoking Status</div>
              <div className="chip-row">
                {['All', 'Never', 'Former', 'Current', 'Unknown'].map(v => (
                  <button key={v} className={`chip${filterSmoking === v ? ' chip-active' : ''}`} onClick={() => setFilterSmoking(v)}>{v}</button>
                ))}
              </div>
            </div>

            {/* Recurrence */}
            <div className="filter-group">
              <div className="filter-label">Recurrence</div>
              <div className="chip-row">
                {['All', 'yes', 'no'].map(v => (
                  <button key={v} className={`chip${filterRecurrence === v ? ' chip-active' : ''}`} onClick={() => setFilterRecurrence(v)}>{v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v}</button>
                ))}
              </div>
            </div>

            {/* Survival */}
            <div className="filter-group">
              <div className="filter-label">Survival Status</div>
              <div className="chip-row">
                {['All', 'living', 'dead'].map(v => (
                  <button key={v} className={`chip${filterSurvival === v ? ' chip-active' : ''}`} onClick={() => setFilterSurvival(v)}>{v === 'living' ? 'Living' : v === 'dead' ? 'Deceased' : v}</button>
                ))}
              </div>
            </div>

            {/* Tumor site */}
            <div className="filter-group">
              <div className="filter-label">Tumor Site</div>
              <select className="filter-select" value={filterTumorSite} onChange={e => setFilterTumorSite(e.target.value)}>
                {TUMOR_SITES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Grading */}
            <div className="filter-group">
              <div className="filter-label">Grading</div>
              <select className="filter-select" value={filterGrading} onChange={e => setFilterGrading(e.target.value)}>
                {GRADINGS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* pT Stage */}
            <div className="filter-group">
              <div className="filter-label">pT Stage</div>
              <div className="chip-row">
                {PT_STAGES.map(v => (
                  <button key={v} className={`chip${filterPT === v ? ' chip-active' : ''}`} onClick={() => setFilterPT(v)}>{v === 'All' ? 'All' : `T${v}`}</button>
                ))}
              </div>
            </div>

            {/* Reset */}
            {activeFilterCount > 0 && (
              <button className="filter-reset" onClick={resetFilters}>
                <X size={11} /> Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Result count */}
        <div className="patient-count">
          {filteredPatients.length} / {patients.length} patients
        </div>

        <div className="patient-list">
          {filteredPatients.map(patient => {
            const genderEmoji = patient.sex === 1 ? '♀' : '♂';
            const genderColor = patient.sex === 1 ? '#f472b6' : '#60a5fa';
            const survivalColor = patient.survival_status === 'living' ? '#22d3ee' : '#94a3b8';
            const isActive = selectedPatient === patient.id;
            return (
              <div
                key={patient.id}
                className={`patient-item${isActive ? ' active' : ''}`}
                onClick={() => handleSelectPatient(patient.id)}
              >
                <div className="patient-item-top">
                  <span className="pid-label">ID</span>
                  <span className="pid-value">{patient.id}</span>
                  <span style={{ marginLeft: 'auto', color: isActive ? '#050709' : genderColor, fontSize: 13 }}>{genderEmoji}</span>
                </div>
                <div className="patient-item-meta">
                  <span>{patient.age}y</span>
                  <span style={{ color: isActive ? '#050709' : survivalColor }}>
                    {patient.survival_status === 'living' ? '● Living' : '○ Deceased'}
                  </span>
                  {patient.recurrence === 'yes' && (
                    <span style={{ color: isActive ? '#050709' : '#ff4b4b' }}>↩ Recur</span>
                  )}
                </div>
              </div>
            );
          })}
          {filteredPatients.length === 0 && (
            <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>No patients match the current filters.</div>
          )}
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="main-content">
        <header className="page-header">
          <h1>OncoGraph X</h1>
          <p>Explainable Graph AI · Precision Oncology · Patient-Level XAI</p>
        </header>

        {/* Tabs */}
        <div className="tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn${activeTab === t.id ? ' tab-active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="center-loader"><Loader2 className="spin" size={44} color="#22d3ee" /></div>
        ) : !data?.feature_importance ? (
          <div className="empty-state">
            <Info size={44} color="#334155" />
            <p>Select a patient from the sidebar to begin analysis</p>
          </div>
        ) : (
          <>
            {/* ═══════════════ TAB: Overview ═══════════════ */}
            {activeTab === 'overview' && (
              <div className="overview-grid">
                <div className="card gauge-card">
                  <Gauge
                    value={data.recurrence_prob}
                    color="#ff4b4b"
                    label="Recurrence Probability"
                    sublabel="Likelihood cancer returns post-treatment"
                  />
                </div>
                <div className="card gauge-card">
                  <Gauge
                    value={data.survival_rate}
                    color="#00d4ff"
                    label="Estimated Survival Rate"
                    sublabel="Normalized probability of long-term survival"
                  />
                </div>

                <div className="card info-card">
                  <h3><Info size={15} /> How Scores Are Computed</h3>
                  <p>The <strong>Recurrence Probability</strong> is the softmax output of the Classification Head — it aggregates blood biomarkers, pathological staging, and the clinical profile of "Twin" patients who shared the same tumor site and pT stage.</p>
                  <p style={{ marginTop: 8 }}>The <strong>Survival Rate</strong> is produced by the Regression Head and is normalized to [0–1] using historical follow-up days weighted by vital status.</p>
                </div>

                <div className="card info-card">
                  <h3><TrendingUp size={15} /> Risk Interpretation Guide</h3>
                  <div className="risk-legend">
                    <div className="risk-row"><span className="dot" style={{ background: '#22d3ee' }} /><div><strong>Low Risk (0–40%)</strong><br /><small>Patient profile aligns with survivors</small></div></div>
                    <div className="risk-row"><span className="dot" style={{ background: '#f59e0b' }} /><div><strong>Moderate Risk (40–70%)</strong><br /><small>Mixed outcomes among Twins</small></div></div>
                    <div className="risk-row"><span className="dot" style={{ background: '#ff4b4b' }} /><div><strong>High Risk (70–100%)</strong><br /><small>Strong pattern match with adverse outcomes</small></div></div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════ TAB: Feature Importance ═══════════════ */}
            {activeTab === 'features' && (
              <div className="feature-tab">
                <div className="card" style={{ padding: '2rem' }}>
                  <div className="feature-header">
                    <h2><BarChart2 size={18} /> Feature Importance for Patient {selectedPatient}</h2>
                    <p>Shows which biomarkers and clinical factors had the most influence on this patient's predictions, as computed by GNNExplainer.</p>
                  </div>

                  <div style={{ height: Math.max(420, (data.feature_importance.length * 44)), marginTop: 24 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={data.feature_importance}
                        margin={{ left: 20, right: 120, top: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} vertical={true} />
                        <XAxis
                          type="number"
                          stroke="#475569"
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          tickFormatter={v => v.toFixed(3)}
                        />
                        <YAxis
                          dataKey="feature"
                          type="category"
                          stroke="#475569"
                          tick={{ fill: '#e2e8f0', fontSize: 12 }}
                          width={230}
                        />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar dataKey="importance" radius={[0, 6, 6, 0]} barSize={22}>
                          {data.feature_importance.map((entry, i) => (
                            <Cell key={i} fill={`hsl(${195 - i * 15}, 90%, ${60 - i * 3}%)`} />
                          ))}
                          <LabelList
                            dataKey="importance"
                            position="right"
                            formatter={v => v.toFixed(4)}
                            style={{ fill: '#94a3b8', fontSize: 11 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="feature-legend">
                    <div className="legend-pill" style={{ background: 'rgba(0,212,255,0.1)', borderColor: '#00d4ff' }}>
                      <Circle size={10} color="#00d4ff" fill="#00d4ff" /> Blood Biomarker (e.g. Leukocytes, Hemoglobin)
                    </div>
                    <div className="legend-pill" style={{ background: 'rgba(124,77,255,0.1)', borderColor: '#7c4dff' }}>
                      <Circle size={10} color="#7c4dff" fill="#7c4dff" /> Pathological Feature (e.g. Infiltration depth, pN Stage)
                    </div>
                    <div className="legend-pill" style={{ background: 'rgba(255,75,75,0.1)', borderColor: '#ff4b4b' }}>
                      <Circle size={10} color="#ff4b4b" fill="#ff4b4b" /> Clinical Covariate (e.g. Age, Smoking Status)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════ TAB: Clinical Twin Map ═══════════════ */}
            {activeTab === 'twins' && (
              <div className="twins-tab">
                <div className="card" style={{ padding: '1.5rem' }}>
                  <div className="twins-header">
                    <h2><GitBranch size={18} /> Clinical Twin Network for Patient {selectedPatient}</h2>
                    <p>Each node is a patient. Edges connect patients with the same <strong>tumor site</strong> and <strong>pT stage</strong>. Edge <strong>thickness</strong> encodes clinical similarity. <strong>Click any Twin node</strong> to re-run the full analysis for that patient — the gauges, feature chart, and graph will all update.</p>
                  </div>

                  {/* Click-to-select banner */}
                  {graphClickBanner && (
                    <div className="click-banner">
                      <Loader2 size={14} className="spin" />
                      Switching to <strong>Patient {graphClickBanner.id}</strong> — recomputing predictions…
                    </div>
                  )}

                  <div className="graph-container">
                    {graphData.nodes.length > 0 ? (
                      <ForceGraph2D
                        ref={fgRef}
                        graphData={graphData}
                        nodeLabel={node => {
                          const genderEmoji = node.sex === 1 ? '♀' : '♂';
                          const genderLabel = node.sex === 1 ? 'Female' : 'Male';
                          const survivalLabel = node.type !== 'target'
                            ? ` · ${node.survival === 'living' ? '✅ Living' : '⬛ Deceased'}`
                            : ' (Selected Patient)';
                          return `${genderEmoji} ${node.label} · ${genderLabel}${survivalLabel}`;
                        }}
                        nodeColor={nodeColor}
                        nodeRelSize={7}
                        linkWidth={link => 1 + (link.normValue || 0) * 7}
                        linkColor={link => `rgba(148,163,184,${0.2 + (link.normValue || 0) * 0.6})`}
                        linkDirectionalParticles={2}
                        linkDirectionalParticleWidth={link => (link.normValue || 0) * 3}
                        linkDirectionalParticleColor={() => '#00d4ff'}
                        onNodeClick={handleNodeClick}
                        onNodeHover={node => setHoveredNode(node)}
                        nodeCanvasObjectMode={() => 'after'}
                        nodeCanvasObject={(node, ctx, globalScale) => {
                          const baseFont = Math.max(9, 11 / globalScale);
                          const emojiFont = Math.max(11, 14 / globalScale);
                          const genderEmoji = node.sex === 1 ? '♀' : '♂';
                          const genderColor = node.sex === 1 ? '#f472b6' : '#60a5fa';

                          // Draw patient label below node
                          ctx.font = `${baseFont}px Inter`;
                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'top';
                          ctx.fillStyle = 'rgba(255,255,255,0.75)';
                          ctx.fillText(node.label, node.x, node.y + 9);

                          // Draw gender emoji to the right of the node circle
                          ctx.font = `${emojiFont}px serif`;
                          ctx.textAlign = 'left';
                          ctx.textBaseline = 'middle';
                          ctx.fillStyle = genderColor;
                          ctx.fillText(genderEmoji, node.x + 8, node.y);
                        }}
                        backgroundColor="#050709"
                        width={undefined}
                        height={500}
                      />
                    ) : (
                      <div className="center-loader">
                        <p style={{ color: '#475569' }}>No twin connections found for this patient</p>
                      </div>
                    )}

                    {/* Legend overlay */}
                    <div className="graph-legend">
                      <div className="legend-title">Node Types</div>
                      <div className="legend-row"><span className="leg-dot" style={{ background: '#ff4b4b' }} /> Target Patient (Selected)</div>
                      <div className="legend-row"><span className="leg-dot" style={{ background: '#00d4ff' }} /> Clinical Twin — <em>Living</em></div>
                      <div className="legend-row"><span className="leg-dot" style={{ background: '#94a3b8' }} /> Clinical Twin — <em>Deceased</em></div>

                      <div className="legend-divider" />
                      <div className="legend-title">Gender</div>
                      <div className="legend-row"><span style={{ color: '#60a5fa', fontSize: 14 }}>♂</span> Male patient</div>
                      <div className="legend-row"><span style={{ color: '#f472b6', fontSize: 14 }}>♀</span> Female patient</div>

                      <div className="legend-divider" />
                      <div className="legend-title">Edge Encoding</div>
                      <div className="legend-row edge-row">
                        <svg width="60" height="12"><line x1="0" y1="6" x2="60" y2="6" stroke="rgba(148,163,184,0.3)" strokeWidth="2" /></svg>
                        <span>Low Similarity</span>
                      </div>
                      <div className="legend-row edge-row">
                        <svg width="60" height="12"><line x1="0" y1="6" x2="60" y2="6" stroke="rgba(148,163,184,0.8)" strokeWidth="7" /></svg>
                        <span>High Similarity</span>
                      </div>
                      <div className="legend-row edge-row">
                        <span style={{ color: '#00d4ff', fontSize: 10 }}>●●●</span>
                        <span>Particles ∝ weight</span>
                      </div>

                      <div className="legend-divider" />
                      <div className="legend-title">Interactions</div>
                      <div className="legend-row"><MousePointer2 size={11} color="#22d3ee" /> <span style={{ color: '#22d3ee' }}>Click twin → load its analysis</span></div>
                      <div className="legend-row"><Minus size={11} color="#94a3b8" /> Scroll to zoom</div>
                    </div>
                  </div>

                  {/* Hovered node info */}
                  {hoveredNode && (
                    <div className="hover-info">
                      <MousePointer2 size={13} color="#22d3ee" />
                      <span style={{ fontSize: 16 }}>
                        {hoveredNode.sex === 1 ? '♀' : '♂'}
                      </span>
                      <strong>{hoveredNode.label}</strong>
                      <span style={{
                        color: hoveredNode.sex === 1 ? '#f472b6' : '#60a5fa',
                        fontSize: 11
                      }}>
                        {hoveredNode.sex === 1 ? 'Female' : 'Male'}
                      </span>
                      {hoveredNode.type === 'target' ? (
                        <span style={{ color: '#ff4b4b', marginLeft: 8 }}>Currently selected</span>
                      ) : (
                        <>
                          <span style={{ color: hoveredNode.survival === 'living' ? '#00d4ff' : '#94a3b8', marginLeft: 8 }}>
                            {hoveredNode.survival === 'living' ? '✅ Living' : '⬛ Deceased'}
                          </span>
                          <span style={{ color: '#64748b', marginLeft: 8, fontSize: 11 }}>— click to run full analysis</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* =============== TAB: About =============== */}
            {activeTab === 'about' && (
              <div className="about-tab">

                {/* ── Hero card ── */}
                <div className="card about-hero">
                  <div className="about-hero-icon"><Dna size={36} color="#22d3ee" /></div>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f0f2f5', marginBottom: 8 }}>
                      OncoGraph X
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.8, maxWidth: 780 }}>
                      An AI-powered clinical decision-support tool that uses a <strong style={{ color: '#22d3ee' }}>Graph Neural Network (GNN)</strong> to
                      predict cancer recurrence risk and survival likelihood for head-and-neck oncology patients.
                      Instead of treating each patient in isolation, the engine connects patients who share similar
                      tumour characteristics — forming a <em>"Twin Graph"</em> network — and learns from the
                      collective outcomes of those similar historical cases.
                    </p>
                  </div>
                </div>

                {/* ── Two-column info grid ── */}
                <div className="about-grid">

                  {/* What problem does it solve? */}
                  <div className="card about-card">
                    <div className="about-card-title"><ShieldCheck size={16} color="#22d3ee" /> The Problem</div>
                    <p>
                      Head-and-neck cancer has a <strong>high recurrence rate</strong> after treatment, yet oncologists
                      often lack quantitative tools to identify which patients are most at risk.
                      Traditional prognostic models ignore the relationships between patients and treat every
                      prediction independently — discarding a wealth of comparative clinical knowledge.
                    </p>
                  </div>

                  {/* Why AI + Graphs? */}
                  <div className="card about-card">
                    <div className="about-card-title"><Network size={16} color="#7c4dff" /> Why Graph AI?</div>
                    <p>
                      A GNN can model <strong>patient similarity as a graph</strong>: patients are nodes, and edges
                      connect those who share the same tumour site and pathological stage. By passing information
                      along edges, the model lets each patient <em>"learn from"</em> their historical twins —
                      patients with comparable profiles whose outcomes are already known.
                    </p>
                  </div>

                  {/* Who is it for? */}
                  <div className="card about-card">
                    <div className="about-card-title"><Stethoscope size={16} color="#f59e0b" /> Who Is It For?</div>
                    <p>
                      <strong>Clinical oncologists</strong> who want a transparent, evidence-based second opinion
                      when planning post-treatment surveillance or adjuvant therapy. The dashboard surfaces
                      <em> which features drove the prediction</em> and shows real historical cases that are
                      similar — making the AI reasoning auditable at the bedside.
                    </p>
                  </div>

                  {/* Why XAI matters */}
                  <div className="card about-card">
                    <div className="about-card-title"><Brain size={16} color="#22d3ee" /> Why Explainability?</div>
                    <p>
                      A black-box AI that just outputs a number is useless — and dangerous — in medicine.
                      This system integrates <strong>GNNExplainer</strong>, which identifies exactly which blood
                      biomarkers, pathological features, and clinical covariates contributed most to each
                      individual prediction, giving clinicians a basis for trust and scrutiny.
                    </p>
                  </div>

                </div>

                {/* ── Input / Output ── */}
                <div className="about-io-row">

                  <div className="card about-io-card">
                    <div className="about-card-title"><FileInput size={16} color="#22d3ee" /> Model Inputs</div>
                    <div className="io-section-label">🩸 Blood Biomarkers (22 features total)</div>
                    <ul className="io-list">
                      <li>Leukocytes, Erythrocytes, Haemoglobin, Haematocrit</li>
                      <li>Thrombocytes, MCV, MCH, MCHC</li>
                      <li>Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils</li>
                      <li>Albumin, Bilirubin, Creatinine, CRP, LDH, AST, ALT, AP, GGT</li>
                    </ul>
                    <div className="io-section-label" style={{ marginTop: 12 }}>🔬 Pathological Features</div>
                    <ul className="io-list">
                      <li>Primary tumour site (oral cavity, oropharynx, hypopharynx, larynx)</li>
                      <li>Pathological T-stage (pT) &amp; N-stage (pN)</li>
                      <li>Histological grading (G1–G4)</li>
                      <li>Infiltration depth (mm)</li>
                      <li>HPV / p16 association</li>
                      <li>Presence of primarily metastatic disease</li>
                    </ul>
                    <div className="io-section-label" style={{ marginTop: 12 }}>👤 Clinical Covariates</div>
                    <ul className="io-list">
                      <li>Age at initial diagnosis</li>
                      <li>Sex</li>
                      <li>Smoking status (never / former / current)</li>
                    </ul>
                    <div className="io-section-label" style={{ marginTop: 12 }}>🕸 Graph Structure</div>
                    <ul className="io-list">
                      <li>Edges connect patients sharing the same tumour site AND pT stage</li>
                      <li>Edge weight = average of grading similarity + pN-stage similarity</li>
                    </ul>
                  </div>

                  <div className="card about-io-card">
                    <div className="about-card-title"><FileOutput size={16} color="#7c4dff" /> Model Outputs</div>

                    <div className="io-output-block" style={{ borderColor: '#ff4b4b' }}>
                      <div className="io-output-title" style={{ color: '#ff4b4b' }}>🔴 Recurrence Probability</div>
                      <p>A percentage (0–100 %) indicating the likelihood the cancer will return after treatment.</p>
                      <ul className="io-list">
                        <li><strong>Low (0–40 %)</strong> — profile aligns with long-term survivors</li>
                        <li><strong>Moderate (40–70 %)</strong> — mixed outcomes among clinical twins</li>
                        <li><strong>High (70–100 %)</strong> — strong match with recurrence patterns</li>
                      </ul>
                    </div>

                    <div className="io-output-block" style={{ borderColor: '#22d3ee', marginTop: 16 }}>
                      <div className="io-output-title" style={{ color: '#22d3ee' }}>🔵 Estimated Survival Rate</div>
                      <p>A normalised score (0–100 %) derived from follow-up days weighted by vital status.
                        Higher scores indicate a stronger alignment with long-term survivors in the twin network.</p>
                    </div>

                    <div className="io-output-block" style={{ borderColor: '#7c4dff', marginTop: 16 }}>
                      <div className="io-output-title" style={{ color: '#7c4dff' }}>🟣 Feature Importance Map</div>
                      <p>A per-patient ranking of which input features most influenced the model's decision,
                        produced by <strong>GNNExplainer</strong>. Enables targeted clinical follow-up.</p>
                    </div>

                    <div className="io-output-block" style={{ borderColor: '#f59e0b', marginTop: 16 }}>
                      <div className="io-output-title" style={{ color: '#f59e0b' }}>🟡 OncoGraph Network</div>
                      <p>An interactive graph showing the top-5 most influential historical patients ("twins")
                        used for this prediction — with their survival status and similarity weights visible.</p>
                    </div>
                  </div>

                </div>

                {/* ── Pipeline steps ── */}
                <div className="card" style={{ padding: '2rem', marginTop: 0 }}>
                  <div className="about-card-title" style={{ marginBottom: 20 }}><FlaskConical size={16} color="#22d3ee" /> How It Works — Step by Step</div>
                  <div className="pipeline-steps">
                    {[
                      { n: '1', color: '#22d3ee', title: 'Data Ingestion', body: 'Four CSV files are merged: clinical demographics, blood biomarkers, pathological reports, and outcome targets (recurrence label + survival days).' },
                      { n: '2', color: '#7c4dff', title: 'Graph Construction', body: 'Patients become nodes. Two patients are connected by an edge if they share the same primary tumour site AND pT stage. Edge weights encode grading and nodal similarity.' },
                      { n: '3', color: '#f59e0b', title: 'GNN Inference', body: 'A two-layer GraphSAGE encoder aggregates information from each patient\'s clinical twins. Shared representations flow into two independent prediction heads.' },
                      { n: '4', color: '#ff4b4b', title: 'Dual-Head Prediction', body: 'Head A outputs a binary recurrence probability (softmax). Head B outputs a continuous survival score (sigmoid regression). Both are shown as gauge charts.' },
                      { n: '5', color: '#22d3ee', title: 'GNNExplainer', body: 'For the selected patient, GNNExplainer runs a small optimisation to find which node features and edges were most important — producing the feature importance chart.' },
                      { n: '6', color: '#7c4dff', title: 'OncoGraph X Visualization', body: 'The top-5 highest-weight twin edges are rendered as an interactive force-directed graph, coloured by survival outcome and sized by similarity weight.' },
                    ].map(s => (
                      <div key={s.n} className="pipeline-step">
                        <div className="step-num" style={{ background: s.color + '22', border: `1px solid ${s.color}`, color: s.color }}>{s.n}</div>
                        <div>
                          <div className="step-title" style={{ color: s.color }}>{s.title}</div>
                          <div className="step-body">{s.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Why it matters ── */}
                <div className="card about-card" style={{ borderColor: 'rgba(0,212,255,0.15)', background: 'rgba(0,212,255,0.04)' }}>
                  <div className="about-card-title"><Info size={16} color="#22d3ee" /> Why This Matters for Patients</div>
                  <p style={{ lineHeight: 1.9 }}>
                    Head-and-neck cancer affects roughly <strong style={{ color: '#f0f2f5' }}>900,000 people globally each year</strong>.
                    Early identification of patients at high recurrence risk can enable more frequent surveillance imaging,
                    timely intervention, and better-tailored adjuvant therapy — potentially saving lives.
                    By grounding predictions in real historical outcomes from comparable patients, this tool
                    moves AI from an opaque oracle to a <strong style={{ color: '#22d3ee' }}>transparent clinical collaborator</strong>.
                  </p>
                  <p style={{ lineHeight: 1.9, marginTop: 10 }}>
                    The explainability layer is equally critical: if a model flags a patient as high-risk because of
                    an elevated CRP level and deep tumour infiltration, a clinician can act on that specific knowledge
                    — rather than accepting a number they cannot interpret or challenge.
                  </p>
                </div>

              </div>
            )}
          </>
        )}
      </main>

      <style jsx>{`
        /* Layout */
        .dashboard { display: flex; min-height: 100vh; font-family: 'Inter', sans-serif; background: #05070a; color: #f0f2f5; }
        .sidebar { width: 290px; background: rgba(10,12,18,0.97); border-right: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; gap: 0.75rem; padding: 1.5rem 1rem; flex-shrink: 0; overflow-y: auto; }
        .sidebar-header { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 700; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
        /* Search */
        .search-box { position: relative; }
        .search-box input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 36px 8px 32px; color: #e2e8f0; font-size: 13px; outline: none; box-sizing: border-box; }
        .search-box input:focus { border-color: #22d3ee; }
        .search-clear { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748b; cursor: pointer; padding: 2px; display: flex; align-items: center; }
        .search-clear:hover { color: #e2e8f0; }
        /* Filter toggle button */
        .filter-toggle { display: flex; align-items: center; gap: 7px; width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 12px; color: #94a3b8; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .filter-toggle:hover { border-color: #22d3ee; color: #22d3ee; }
        .filter-toggle-open { border-color: #22d3ee; color: #22d3ee; background: rgba(0,212,255,0.05); }
        .filter-badge { background: #22d3ee; color: #050709; border-radius: 100px; font-size: 10px; font-weight: 700; padding: 1px 6px; }
        /* Filter panel */
        .filter-panel { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px; animation: fadeIn 0.2s ease; }
        .filter-group { display: flex; flex-direction: column; gap: 5px; }
        .filter-label { font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #475569; }
        .filter-num { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 5px 8px; color: #e2e8f0; font-size: 12px; outline: none; width: 0; }
        .filter-num:focus { border-color: #22d3ee; }
        .filter-select { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 5px 8px; color: #e2e8f0; font-size: 12px; outline: none; }
        .filter-select:focus { border-color: #22d3ee; }
        .filter-select option { background: #0f172a; }
        /* Chips */
        .chip-row { display: flex; flex-wrap: wrap; gap: 4px; }
        .chip { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 100px; padding: 3px 9px; font-size: 11px; color: #94a3b8; cursor: pointer; transition: all 0.15s; }
        .chip:hover { border-color: #22d3ee; color: #22d3ee; }
        .chip-active { background: rgba(0,212,255,0.15); border-color: #22d3ee !important; color: #22d3ee !important; }
        /* Reset */
        .filter-reset { display: flex; align-items: center; gap: 5px; background: rgba(255,75,75,0.08); border: 1px solid rgba(255,75,75,0.25); border-radius: 6px; padding: 5px 10px; color: #fca5a5; font-size: 11px; cursor: pointer; transition: all 0.15s; width: 100%; }
        .filter-reset:hover { background: rgba(255,75,75,0.15); }
        /* Patient count */
        .patient-count { font-size: 11px; color: #475569; text-align: right; padding-right: 2px; }
        /* Patient list */
        .patient-list { overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
        .patient-item { display: flex; flex-direction: column; gap: 3px; padding: 7px 10px; border-radius: 8px; cursor: pointer; background: rgba(255,255,255,0.02); transition: all 0.2s; border: 1px solid transparent; }
        .patient-item:hover { background: rgba(0,212,255,0.07); border-color: rgba(0,212,255,0.2); }
        .patient-item.active { background: #22d3ee; color: #050709; font-weight: 700; border-color: transparent; }
        .patient-item.active span { color: #050709 !important; }
        .patient-item-top { display: flex; align-items: center; gap: 6px; }
        .pid-label { font-size: 10px; color: #475569; }
        .pid-value { font-size: 13px; font-weight: 600; }
        .patient-item.active .pid-label { color: #050709 !important; }
        .patient-item-meta { display: flex; gap: 8px; font-size: 10px; color: #64748b; }
        .main-content { flex: 1; padding: 2.5rem; overflow-y: auto; min-width: 0; }
        .page-header { margin-bottom: 1.5rem; }
        .page-header h1 { font-size: 2rem; font-weight: 800; background: linear-gradient(90deg, #fff, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .page-header p { color: #64748b; font-size: 13px; margin-top: 4px; letter-spacing: 0.04em; }

        /* Tabs */
        .tabs { display: flex; gap: 8px; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 0; }
        .tab-btn { display: flex; align-items: center; gap: 6px; padding: 10px 18px; border: none; border-bottom: 2px solid transparent; background: transparent; color: #64748b; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; border-radius: 8px 8px 0 0; }
        .tab-btn:hover { color: #e2e8f0; background: rgba(255,255,255,0.04); }
        .tab-active { color: #22d3ee !important; border-bottom-color: #22d3ee !important; background: rgba(0,212,255,0.06) !important; }

        /* Cards */
        .card { background: rgba(20,24,33,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 1.5rem; }

        /* Overview */
        .overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .gauge-card { display: flex; align-items: center; justify-content: center; min-height: 260px; }
        .info-card h3 { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #22d3ee; margin-bottom: 10px; }
        .info-card p { font-size: 13px; color: #94a3b8; line-height: 1.7; }
        .risk-legend { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
        .risk-row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; }
        .risk-row strong { color: #e2e8f0; }
        .risk-row small { color: #64748b; }
        .dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }

        /* Feature Tab */
        .feature-tab { width: 100%; }
        .feature-header h2 { font-size: 18px; font-weight: 700; color: #e2e8f0; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .feature-header p { font-size: 13px; color: #64748b; line-height: 1.6; }
        .feature-legend { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
        .legend-pill { display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 100px; border: 1px solid; font-size: 12px; color: #94a3b8; }

        /* Twins Tab */
        .twins-tab { width: 100%; }
        .twins-header h2 { font-size: 18px; font-weight: 700; color: #e2e8f0; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .twins-header p { font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 1rem; }
        .graph-container { position: relative; border-radius: 12px; overflow: hidden; background: #050709; border: 1px solid rgba(255,255,255,0.06); }
        .graph-legend { position: absolute; top: 12px; right: 12px; background: rgba(5,7,10,0.88); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #94a3b8; min-width: 180px; }
        .legend-title { font-size: 10px; font-weight: 700; color: #475569; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
        .legend-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .edge-row { gap: 10px; }
        .leg-dot { display: inline-block; width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
        .legend-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 8px 0; }
        .hover-info { margin-top: 10px; padding: 8px 14px; background: rgba(0,212,255,0.07); border: 1px solid rgba(0,212,255,0.2); border-radius: 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
        .click-banner { display: flex; align-items: center; gap: 10px; padding: 10px 16px; margin-bottom: 12px; background: rgba(255,75,75,0.1); border: 1px solid rgba(255,75,75,0.3); border-radius: 10px; font-size: 13px; color: #fca5a5; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

        /* Utils */
        .center-loader { display: flex; align-items: center; justify-content: center; height: 400px; }
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; gap: 16px; color: #334155; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* About Tab */
        .about-tab { display: flex; flex-direction: column; gap: 1.5rem; animation: fadeIn 0.4s ease; }
        .about-hero { display: flex; align-items: flex-start; gap: 1.5rem; background: linear-gradient(135deg, rgba(34,211,238,0.1) 0%, rgba(10,12,18,0.7) 100%); border-color: rgba(34,211,238,0.2); }
        .about-hero-icon { background: rgba(34,211,238,0.1); padding: 1rem; border-radius: 12px; border: 1px solid rgba(34,211,238,0.2); }
        .about-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; }
        .about-card { display: flex; flex-direction: column; gap: 0.75rem; transition: transform 0.2s; }
        .about-card:hover { transform: translateY(-2px); border-color: rgba(34,211,238,0.3); }
        .about-card-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #f0f2f5; }
        .about-card p { font-size: 13px; line-height: 1.6; color: #94a3b8; }
        .about-io-row { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; }
        .about-io-card { height: 100%; }
        .io-section-label { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; margin-bottom: 8px; }
        .io-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .io-list li { font-size: 13px; color: #94a3b8; display: flex; align-items: flex-start; gap: 8px; }
        .io-list li::before { content: "•"; color: #22d3ee; }
        .io-output-block { border-left: 3px solid; padding-left: 12px; background: rgba(255,255,255,0.02); padding: 10px 14px; border-radius: 0 8px 8px 0; }
        .io-output-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
        .io-output-block p { font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 6px; }
        .pipeline-steps { display: flex; flex-direction: column; gap: 1.25rem; }
        .pipeline-step { display: flex; gap: 1.25rem; }
        .step-num { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; flex-shrink: 0; }
        .step-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
        .step-body { font-size: 13px; color: #94a3b8; line-height: 1.6; }
      `}</style>
    </div>
  );
}
