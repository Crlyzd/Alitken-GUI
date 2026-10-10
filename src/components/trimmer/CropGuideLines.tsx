import React from 'react';

interface CropGuideLinesProps {
  isDraggingMove: boolean;
  isDraggingResize: string | null;
  cropOffset: { x: number; y: number };
  isSnappedX: boolean;
  isSnappedY: boolean;
  isSnappedLeft: boolean;
  isSnappedRight: boolean;
  isSnappedTop: boolean;
  isSnappedBottom: boolean;
  isMagnetActive: boolean;
  activeAxisLock: 'vertical' | 'horizontal' | 'both' | null;
}

export const CropGuideLines: React.FC<CropGuideLinesProps> = ({
  isDraggingMove,
  isDraggingResize,
  cropOffset,
  isSnappedX,
  isSnappedY,
  isSnappedLeft,
  isSnappedRight,
  isSnappedTop,
  isSnappedBottom,
  isMagnetActive,
  activeAxisLock,
}) => {
  return (
    <>
      {/* Thin Glowing Center Cross Section Magnet Guide Lines */}
      {isDraggingMove && (isSnappedX || Math.abs(cropOffset.x - 0.5) < 0.001) && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: '1px',
            transform: 'translateX(-50%)',
            background: 'rgba(6, 182, 212, 0.95)',
            boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      )}

      {isDraggingMove && (isSnappedY || Math.abs(cropOffset.y - 0.5) < 0.001) && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: '1px',
            transform: 'translateY(-50%)',
            background: 'rgba(6, 182, 212, 0.95)',
            boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      )}

      {/* Outer Container Edge Magnet Guide Lines (Alt key move or resize) */}
      {(isDraggingMove || isDraggingResize) && isSnappedLeft && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '1px',
            background: 'rgba(6, 182, 212, 0.95)',
            boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      )}

      {(isDraggingMove || isDraggingResize) && isSnappedRight && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: '1px',
            background: 'rgba(6, 182, 212, 0.95)',
            boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      )}

      {(isDraggingMove || isDraggingResize) && isSnappedTop && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: '1px',
            background: 'rgba(6, 182, 212, 0.95)',
            boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      )}

      {(isDraggingMove || isDraggingResize) && isSnappedBottom && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '1px',
            background: 'rgba(6, 182, 212, 0.95)',
            boxShadow: '0 0 4px rgba(6, 182, 212, 0.8)',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      )}

      {/* Center Crosshair Point indicator when both axes are centered */}
      {isDraggingMove &&
        (isSnappedX || Math.abs(cropOffset.x - 0.5) < 0.001) &&
        (isSnappedY || Math.abs(cropOffset.y - 0.5) < 0.001) && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#ffffff',
              border: '1.5px solid var(--accent-cyan)',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 8px var(--accent-cyan)',
              pointerEvents: 'none',
              zIndex: 26,
            }}
          />
        )}

      {/* Axis & Magnet Lock Feedback Toast */}
      {(isDraggingMove || isDraggingResize) && (activeAxisLock || isMagnetActive) && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 10px',
            borderRadius: '6px',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            color: 'var(--accent-cyan)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 35,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent-cyan)',
              boxShadow: '0 0 6px var(--accent-cyan)',
              flexShrink: 0,
            }}
          />
          {activeAxisLock === 'vertical' && 'SHIFT: Locked Vertical'}
          {activeAxisLock === 'horizontal' && 'CTRL: Locked Horizontal'}
          {activeAxisLock === 'both' && 'SHIFT + CTRL: Position Locked'}
          {isMagnetActive &&
            !activeAxisLock &&
            (isDraggingResize ? 'Resize Magnet Active' : 'Edge Magnet Active')}
        </div>
      )}
    </>
  );
};
