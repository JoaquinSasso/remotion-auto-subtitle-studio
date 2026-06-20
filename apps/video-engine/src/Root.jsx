import { Composition, registerRoot } from 'remotion';
import { VideoComposition } from './Composition';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="Composition"
        component={VideoComposition}
        durationInFrames={900} // 30 seconds at 30fps (overridden dynamically during render)
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoSrc: '',
          subtitles: [
            { text: 'CREA', start: 0.2, end: 0.6 },
            { text: 'VIDEOS', start: 0.6, end: 1.0 },
            { text: 'INCREÍBLES', start: 1.0, end: 1.6 },
            { text: 'CON', start: 1.6, end: 1.9 },
            { text: 'REMOTION', start: 1.9, end: 2.5 },
            { text: 'Y', start: 2.5, end: 2.8 },
            { text: 'WHISPER', start: 2.8, end: 3.5 }
          ],
          config: {
            activeColor: '#EAB308', // yellow-500
            inactiveColor: '#FFFFFF',
            bounceIntensity: 0.3,
            fontName: 'Impact',
            fontSize: 56
          }
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
