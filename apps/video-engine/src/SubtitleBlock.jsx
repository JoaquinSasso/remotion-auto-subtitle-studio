import { useCurrentFrame, useVideoConfig, spring } from 'remotion';

export const SubtitleBlock = ({ words, config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: '14px',
      fontFamily: config.fontName || 'Impact',
      fontSize: `${config.fontSize || 50}px`,
      textTransform: 'uppercase',
      textShadow: '4px 4px 0px #000000',
      letterSpacing: '1px'
    }}>
      {words.map((word, index) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;
        
        // Generación de física elástica (Bounce) nativa de Remotion
        const bounceSpring = spring({
          frame: Math.max(0, frame - (word.start * fps)),
          fps,
          config: { damping: 11, mass: 0.4, stiffness: 120 },
        });

        // Aplicación condicional de escala y paleta de colores
        const scale = isActive ? 1 + (bounceSpring * (config.bounceIntensity || 0.3)) : 1;
        const color = isActive ? config.activeColor : config.inactiveColor;

        return (
          <span
            key={index}
            style={{
              color: color,
              transform: `scale(${scale})`,
              display: 'inline-block',
              transition: 'color 0.04s ease-in-out'
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
