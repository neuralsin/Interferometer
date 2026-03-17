import React from 'react';
import useSimulationStore from '../store/simulationStore.js';

/**
 * Mode Toggle — V3 style
 * Beginner mode: shows "GUIDED MODE" button (matching unified_beginner_mode)
 * Research mode: shows toggle + "Research" label
 */
const ModeToggle = () => {
  const isResearchMode = useSimulationStore((s) => s.isResearchMode);
  const toggleResearchMode = useSimulationStore((s) => s.toggleResearchMode);

  if (!isResearchMode) {
    // Beginner mode: V3 shows a clean "GUIDED MODE" button in header
    return (
      <button className="btn-primary" onClick={toggleResearchMode}
        style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
        Guided Mode
      </button>
    );
  }

  // Research mode: toggle switch
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        className="toggle-track"
        data-active={isResearchMode}
        onClick={toggleResearchMode}
        aria-label="Toggle research mode"
      />
      <span style={{
        fontSize: '9px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: '#fff',
      }}>
        Research
      </span>
    </div>
  );
};

export default ModeToggle;
