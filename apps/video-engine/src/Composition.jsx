import { useCurrentFrame, useVideoConfig, OffthreadVideo, AbsoluteFill } from 'remotion';
import { SubtitleBlock } from './SubtitleBlock';

export const VideoComposition = ({ videoSrc, subtitles = [], config = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Group words into groups of 3-4 words so they fit on the screen together
  const groupSize = 3;
  const wordGroups = [];
  for (let i = 0; i < subtitles.length; i += groupSize) {
    const groupWords = subtitles.slice(i, i + groupSize);
    if (groupWords.length > 0) {
      wordGroups.push({
        words: groupWords,
        start: groupWords[0].start,
        end: groupWords[groupWords.length - 1].end + 0.1, // brief hold
      });
    }
  }

  // Find the active group for the current time
  const activeGroup = wordGroups.find(
    (g) => currentTime >= g.start && currentTime <= g.end
  ) || wordGroups.find(
    (g) => currentTime >= g.start
  ); // fallback to nearest past group

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {/* Underlying Video */}
      {videoSrc && (
        <OffthreadVideo
          src={videoSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Styled Overlay container for subtitutes */}
      <AbsoluteFill
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          top: '70%', // Position near lower third
          height: '20%',
          pointerEvents: 'none',
        }}
      >
        {activeGroup && (
          <div className="animate-bounce-sub">
            <SubtitleBlock words={activeGroup.words} config={config} />
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
