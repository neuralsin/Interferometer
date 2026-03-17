import React from 'react';
import useSimulationStore from '../store/simulationStore.js';

const ModeToggle = () => {
  const isResearchMode = useSimulationStore((s) => s.isResearchMode);
  const toggleResearchMode = useSimulationStore((s) => s.toggleResearchMode);

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
        color: isResearchMode ? '#fff' : 'var(--text-mercury)',
      }}>
        {isResearchMode ? 'Research' : 'Beginner'}
      </span>
    </div>
  );
};

export default ModeToggle;
