import React, { useState } from 'react';
import useSimulationStore from '../store/simulationStore.js';
import BeginnerPanel from './BeginnerPanel.jsx';
import ResearchPanel from './ResearchPanel.jsx';
import { exportCSV, exportImage, exportJSON } from '../physics/dataExport.js';

const Sidebar = () => {
  const isResearchMode = useSimulationStore((s) => s.isResearchMode);
  const resetToDefaults = useSimulationStore((s) => s.resetToDefaults);
  const [showExport, setShowExport] = useState(false);

  const handleExport = (type) => {
    const state = useSimulationStore.getState();
    if (type === 'csv') exportCSV(state);
    else if (type === 'png') exportImage(state);
    else if (type === 'json') exportJSON(state);
    setShowExport(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Section Title */}
      <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 24 }}>
        <h2 className="label-micro" style={{ color: 'var(--text-silver-400)' }}>
          {isResearchMode ? 'Research Controls' : 'Guided Controls'}
        </h2>
      </div>

      {/* Mode-conditional panels */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isResearchMode ? <ResearchPanel /> : <BeginnerPanel />}
      </div>

      {/* Bottom Actions */}
      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={resetToDefaults}>
            Reset_Defaults
          </button>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowExport(!showExport)}>
            Export
          </button>
        </div>

        {showExport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="btn-ghost" onClick={() => handleExport('csv')} style={{ justifyContent: 'flex-start' }}>
              📄 CSV (Intensity)
            </button>
            <button className="btn-ghost" onClick={() => handleExport('png')} style={{ justifyContent: 'flex-start' }}>
              🖼 PNG (Detector)
            </button>
            <button className="btn-ghost" onClick={() => handleExport('json')} style={{ justifyContent: 'flex-start' }}>
              ⚙ JSON (Config)
            </button>
          </div>
        )}

        {isResearchMode && (
          <div style={{
            fontSize: 8, color: 'rgba(255,255,255,0.3)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.15em',
            textTransform: 'uppercase', marginTop: 8,
          }}>
            G = Move • R = Rotate • Esc = Deselect
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
