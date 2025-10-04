import React, { useEffect, useState } from 'react'
import type { CraftingResultDisplay } from '../CraftingGUITypes'

interface CraftingResultProps {
  result: CraftingResultDisplay | null
  onCraft: () => void
  isProcessing: boolean
  showAnimation: boolean
  className?: string
}

export const CraftingResult: React.FC<CraftingResultProps> = ({
  result,
  onCraft,
  isProcessing,
  showAnimation,
  className = '',
}) => {
  const [isAnimating, setIsAnimating] = useState(false)
  const [showParticles, setShowParticles] = useState(false)

  useEffect(() => {
    if (showAnimation) {
      setIsAnimating(true)
      setShowParticles(true)

      const animTimer = setTimeout(() => setIsAnimating(false), 500)
      const particleTimer = setTimeout(() => setShowParticles(false), 1000)

      return () => {
        clearTimeout(animTimer)
        clearTimeout(particleTimer)
      }
    }
  }, [showAnimation])

  const canCraft = result?.canCraft && !isProcessing
  const hasResult = result?.result !== undefined

  return (
    <div className={`crafting-result ${className}`}>
      <h3>Result</h3>

      <div
        className={`
        result-slot
        ${hasResult ? 'has-result' : 'empty'}
        ${canCraft ? 'can-craft' : ''}
        ${isAnimating ? 'animating' : ''}
        ${isProcessing ? 'processing' : ''}
      `}
      >
        {hasResult && result?.result && (
          <>
            <div className="result-item">
              <div className="item-icon">
                <span>{(result.result as any).itemId.split(':').pop()?.charAt(0).toUpperCase()}</span>
              </div>
              {(result.result as any).count > 1 && <span className="item-count">×{(result.result as any).count}</span>}
            </div>
            {showParticles && (
              <div className="craft-particles">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={`particle particle-${i}`}>
                    ✨
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {!hasResult && (
          <div className="empty-slot-hint">
            <span>?</span>
          </div>
        )}
      </div>

      <button className={`craft-button ${canCraft ? 'enabled' : 'disabled'}`} onClick={onCraft} disabled={!canCraft}>
        {isProcessing ? 'Crafting...' : !hasResult ? 'No Recipe' : !result?.canCraft ? 'Missing Items' : 'Craft'}
      </button>

      {result?.missingIngredients && result.missingIngredients.length > 0 && (
        <div className="missing-ingredients">
          <h4>Missing:</h4>
          <div className="missing-list">
            {result.missingIngredients.map((item: any, index) => (
              <div key={index} className="missing-item">
                <span className="missing-icon">{item.itemId.split(':').pop()?.charAt(0).toUpperCase()}</span>
                <span className="missing-count">×{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result?.recipe ? (
        <div className="recipe-info">
          <span className="recipe-name">{(result.recipe as any).result.itemId.split(':').pop()}</span>
          <span className="recipe-type">{(result.recipe as any)._tag}</span>
        </div>
      ) : null}

      <style>{`
        .crafting-result {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid #4a2511;
          border-radius: 8px;
          min-width: 180px;
        }

        .crafting-result h3 {
          margin: 0;
          color: #ffc107;
          font-size: 18px;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        }

        .result-slot {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #6b4423 0%, #4a2f1a 100%);
          border: 3px solid #3d2515;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: all 0.3s ease;
        }

        .result-slot.empty {
          background: linear-gradient(135deg, #524135 0%, #3d3229 100%);
        }

        .result-slot.has-result {
          background: linear-gradient(135deg, #7d5a3a 0%, #5a3f2a 100%);
        }

        .result-slot.can-craft {
          border-color: #4caf50;
          box-shadow: 0 0 12px rgba(76, 175, 80, 0.6);
        }

        .result-slot.can-craft::before {
          content: '';
          position: absolute;
          top: -3px;
          left: -3px;
          right: -3px;
          bottom: -3px;
          background: linear-gradient(45deg, #4caf50, #8bc34a);
          border-radius: 4px;
          opacity: 0.3;
          animation: pulse 2s infinite;
        }

        .result-slot.animating {
          animation: craftSuccess 0.5s ease-in-out;
        }

        .result-slot.processing {
          animation: processing 1s infinite;
        }

        .result-item {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .item-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #8b7355 0%, #6b5a45 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          color: white;
          font-size: 24px;
          font-weight: bold;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        }

        .item-count {
          position: absolute;
          bottom: 2px;
          right: 2px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 2px 6px;
          border-radius: 2px;
          font-size: 14px;
          font-weight: bold;
        }

        .empty-slot-hint {
          color: rgba(255, 255, 255, 0.3);
          font-size: 32px;
          font-weight: bold;
        }

        .craft-button {
          padding: 10px 24px;
          background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
          border: 2px solid #388e3c;
          border-radius: 4px;
          color: white;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
          min-width: 120px;
        }

        .craft-button.enabled:hover {
          background: linear-gradient(135deg, #66bb6a 0%, #4caf50 100%);
          transform: scale(1.05);
          box-shadow: 0 4px 8px rgba(76, 175, 80, 0.4);
        }

        .craft-button.enabled:active {
          transform: scale(0.98);
        }

        .craft-button.disabled {
          background: linear-gradient(135deg, #6b6b6b 0%, #4a4a4a 100%);
          border-color: #3a3a3a;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .missing-ingredients {
          margin-top: 8px;
          padding: 8px;
          background: rgba(255, 87, 34, 0.1);
          border: 1px solid rgba(255, 87, 34, 0.3);
          border-radius: 4px;
        }

        .missing-ingredients h4 {
          margin: 0 0 8px 0;
          color: #ff5722;
          font-size: 12px;
        }

        .missing-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .missing-item {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 2px;
        }

        .missing-icon {
          width: 20px;
          height: 20px;
          background: rgba(255, 87, 34, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 2px;
          color: white;
          font-size: 12px;
        }

        .missing-count {
          color: rgba(255, 255, 255, 0.8);
          font-size: 12px;
        }

        .recipe-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
        }

        .recipe-name {
          color: white;
          font-size: 14px;
          font-weight: bold;
        }

        .recipe-type {
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
        }

        .craft-particles {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .particle {
          position: absolute;
          font-size: 16px;
          animation: particleFly 1s ease-out forwards;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }

        @keyframes craftSuccess {
          0% { transform: scale(1); }
          25% { transform: scale(1.2); }
          50% { transform: scale(0.9); }
          75% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        @keyframes processing {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes particleFly {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(0);
          }
          50% {
            opacity: 1;
            transform: translate(var(--x, 30px), var(--y, -30px)) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(var(--x, 30px) * 2), calc(var(--y, -30px) * 2)) scale(0.5);
          }
        }

        .particle-0 { --x: -40px; --y: -40px; animation-delay: 0ms; }
        .particle-1 { --x: 40px; --y: -40px; animation-delay: 100ms; }
        .particle-2 { --x: -40px; --y: 40px; animation-delay: 200ms; }
        .particle-3 { --x: 40px; --y: 40px; animation-delay: 300ms; }
        .particle-4 { --x: 0; --y: -50px; animation-delay: 400ms; }
        .particle-5 { --x: 0; --y: 50px; animation-delay: 500ms; }
        .particle-6 { --x: -50px; --y: 0; animation-delay: 600ms; }
        .particle-7 { --x: 50px; --y: 0; animation-delay: 700ms; }
      `}</style>
    </div>
  )
}
