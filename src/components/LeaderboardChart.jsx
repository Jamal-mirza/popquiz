import React from "react";

export default function LeaderboardChart({ players }) {
  // Sort players descending by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  // Find maximum score to calculate percentage heights
  const maxScore = Math.max(...players.map(p => p.score), 100);

  return (
    <div className="leaderboard-chart-container">
      <div className="chart-bars-wrapper">
        {sortedPlayers.map((player, index) => {
          // Calculate height percentage (min 10% for visual structure when score is 0)
          const heightPercent = Math.max((player.score / maxScore) * 100, 10);
          const rank = index + 1;
          const isTop3 = rank <= 3;
          
          let rankClass = "rank-other";
          let medalEmoji = "";
          if (rank === 1) { rankClass = "rank-1"; medalEmoji = "👑"; }
          else if (rank === 2) { rankClass = "rank-2"; medalEmoji = "🥈"; }
          else if (rank === 3) { rankClass = "rank-3"; medalEmoji = "🥉"; }

          return (
            <div key={player.id} className={`chart-column-container ${rankClass}`}>
              {/* Score bar */}
              <div className="bar-outer">
                {/* Round status indicator (correct/wrong) */}
                {player.status === "submitted" && (
                  <div className={`round-outcome-bubble ${player.currentRoundAnswer ? "outcome-correct" : "outcome-incorrect"}`}>
                    {player.currentRoundAnswer ? "+100" : "+0"}
                  </div>
                )}
                
                {/* Rank Badge on top of the bar for top 3 */}
                {isTop3 && (
                  <div className={`rank-badge badge-${rank}`}>
                    {rank}
                  </div>
                )}

                {/* Animated Inner Bar */}
                <div 
                  className={`bar-inner bar-${rank}`} 
                  style={{ height: `${heightPercent}%` }}
                >
                  <span className="bar-score-display">{player.score}</span>
                </div>
              </div>

              {/* Player details */}
              <div className="player-info-card">
                <span className="player-rank-number">#{rank}</span>
                <span className="player-name-text" title={player.name}>
                  {player.name} {player.isBot && <span className="bot-label">BOT</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
