import React from 'react';

export interface FilmstripTrackProps {
  filmstrip: string[];
  startPercent: number;
  endPercent: number;
}

export const FilmstripTrack: React.FC<FilmstripTrackProps> = ({
  filmstrip,
  startPercent,
  endPercent,
}) => {
  return (
    <>
      {/* Background Filmstrip Track Tiles */}
      {filmstrip.length > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            opacity: 0.85,
            pointerEvents: 'none',
          }}
        >
          {filmstrip.map((thumb, idx) => (
            <img
              key={idx}
              src={thumb}
              alt={`Filmstrip ${idx}`}
              style={{
                flex: 1,
                height: '100%',
                objectFit: 'cover',
                filter: 'brightness(1.0) contrast(1.05)',
              }}
            />
          ))}
        </div>
      )}

      {/* Unselected Left Area */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: `${startPercent}%`,
          height: '100%',
          background: 'rgba(0, 0, 0, 0.32)',
          backdropFilter: 'brightness(0.82)',
          borderTopLeftRadius: '9px',
          borderBottomLeftRadius: '9px',
        }}
      />

      {/* Unselected Right Area */}
      <div
        style={{
          position: 'absolute',
          left: `${endPercent}%`,
          right: 0,
          height: '100%',
          background: 'rgba(0, 0, 0, 0.32)',
          backdropFilter: 'brightness(0.82)',
          borderTopRightRadius: '9px',
          borderBottomRightRadius: '9px',
        }}
      />
    </>
  );
};
