/**
 * 
 * 
 */

import { useRef } from 'react'
import './TwinsPanel.css'

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



export default function TwinsPanel({ selectedPatient, data, setData, graphData, setGraphData,
  hoveredNode, setHoveredNode,
  graphClickBanner, setGraphClickBanner, patients, setPatients,
  handleNodeClick, nodeColor, twinDataLoading }) {
  const fgRef = useRef();
  const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

  return (
    <div className="twins-tab">
      <div className="card" style={{ padding: '1.5rem' }}>
        <div className="twins-header">
          <h2><GitBranch size={18} /> Clinical Twin Network for Patient {selectedPatient.patient_id}</h2>
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
          {graphData.nodes.length > 0 && (
            <div>
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
                // onNodeHover={node => setHoveredNode(node)}
                nodeCanvasObjectMode={() => 'after'}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  if (node.x == null || node.y == null) return;

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
            </div>
          )}

          {/* Loading or empty state overlay */}
          {graphData.nodes.length === 0 && (
            <div className="center-loader">
              {twinDataLoading ? (
                <>
                  <Loader2 size={32} className="spin" style={{ color: '#22d3ee', marginBottom: '16px' }} />
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading twin network data…</p>
                </>
              ) : (
                <p style={{ color: '#475569' }}>No twin connections found for this patient</p>
              )}
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

          {/* Loading overlay when data is refreshing */}
          {twinDataLoading && graphData.nodes.length > 0 && (
            <div className="graph-loading-overlay">
              <Loader2 size={28} className="spin" style={{ color: '#22d3ee' }} />
            </div>
          )}
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
  )
}
