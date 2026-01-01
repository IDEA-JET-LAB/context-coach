import React, { useState, useEffect } from "react";

export type TeamTimeRange = "today" | "week" | "month";

export interface TeamMemberStats {
  userId: string;
  name: string;
  avatarUrl: string | null;
  promptCount: number;
  avgScore: number;
  scoreChange: number | null;
  avgCharCount: number;
  rank: number;
}

export interface TeamStatsData {
  members: TeamMemberStats[];
  teamName: string;
  timeRange: TeamTimeRange;
  currentUserId: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  memberCount: number;
}

interface TeamPanelProps {
  teams: TeamInfo[];
  teamsLoading: boolean;
  selectedTeamId: string | null;
  data: TeamStatsData | null;
  isLoading: boolean;
  onTeamChange: (teamId: string) => void;
  onTimeRangeChange: (teamId: string, timeRange: TeamTimeRange) => void;
  onRefresh: () => void;
}

// Score change indicator
const ScoreChange: React.FC<{ change: number | null }> = ({ change }) => {
  if (change === null) return <span className="score-change neutral">--</span>;

  const isPositive = change > 0;
  const isNegative = change < 0;
  const formatted = isPositive ? `+${change.toFixed(1)}` : change.toFixed(1);

  return (
    <span className={`score-change ${isPositive ? "positive" : isNegative ? "negative" : "neutral"}`}>
      {formatted}
    </span>
  );
};

// Simple rank display (plain text, no colors)
const RankDisplay: React.FC<{ rank: number }> = ({ rank }) => {
  return <span className="rank-number">{rank}</span>;
};

// Avatar component with fallback
const Avatar: React.FC<{ url: string | null; name: string }> = ({ url, name }) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (url) {
    return <img className="member-avatar" src={url} alt={name} />;
  }

  return <div className="member-avatar placeholder">{initials}</div>;
};

export const TeamPanel: React.FC<TeamPanelProps> = ({
  teams,
  teamsLoading,
  selectedTeamId,
  data,
  isLoading,
  onTeamChange,
  onTimeRangeChange,
  onRefresh,
}) => {
  const [activeRange, setActiveRange] = useState<TeamTimeRange>("today");

  const handleRangeChange = (range: TeamTimeRange) => {
    setActiveRange(range);
    if (selectedTeamId) {
      onTimeRangeChange(selectedTeamId, range);
    }
  };

  const handleTeamSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teamId = e.target.value;
    if (teamId) {
      onTeamChange(teamId);
    }
  };

  // Loading teams
  if (teamsLoading) {
    return (
      <div className="team-panel">
        <div className="loading-container">
          <div className="loading-spinner" />
          <span className="loading-text">Loading teams...</span>
        </div>
      </div>
    );
  }

  // No teams
  if (teams.length === 0) {
    return (
      <div className="team-panel">
        <div className="team-header">
          <h3>Team Performance</h3>
          <button className="icon-button" onClick={onRefresh} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
        <div className="team-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p>No teams found</p>
          <span>Join a team to see performance metrics</span>
        </div>
      </div>
    );
  }

  // Loading team stats
  if (isLoading) {
    return (
      <div className="team-panel">
        <div className="team-header">
          <div className="team-selector">
            <label className="team-selector-label">Team</label>
            <select
              value={selectedTeamId || ""}
              onChange={handleTeamSelect}
              className="team-dropdown"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} · {team.memberCount}
                </option>
              ))}
            </select>
          </div>
          <button className="icon-button" onClick={onRefresh} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
        <div className="loading-container">
          <div className="loading-spinner" />
          <span className="loading-text">Loading team stats...</span>
        </div>
      </div>
    );
  }

  if (!data || data.members.length === 0) {
    return (
      <div className="team-panel">
        <div className="team-header">
          <div className="team-selector">
            <label className="team-selector-label">Team</label>
            <select
              value={selectedTeamId || ""}
              onChange={handleTeamSelect}
              className="team-dropdown"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} · {team.memberCount}
                </option>
              ))}
            </select>
          </div>
          <button className="icon-button" onClick={onRefresh} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
        <div className="team-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p>No team data available</p>
          <span>Team members will appear here once they start prompting</span>
        </div>
      </div>
    );
  }

  // Find current user's stats
  const currentUserStats = data.members.find((m) => m.userId === data.currentUserId);

  return (
    <div className="team-panel">
      <div className="team-header">
        <div className="team-selector">
          <label className="team-selector-label">Team</label>
          <select
            value={selectedTeamId || ""}
            onChange={handleTeamSelect}
            className="team-dropdown"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} · {team.memberCount}
              </option>
            ))}
          </select>
        </div>
        <button className="icon-button" onClick={onRefresh} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* Time range filter */}
      <div className="team-time-filter">
        <button
          className={`filter-btn ${activeRange === "today" ? "active" : ""}`}
          onClick={() => handleRangeChange("today")}
        >
          Today
        </button>
        <button
          className={`filter-btn ${activeRange === "week" ? "active" : ""}`}
          onClick={() => handleRangeChange("week")}
        >
          This Week
        </button>
        <button
          className={`filter-btn ${activeRange === "month" ? "active" : ""}`}
          onClick={() => handleRangeChange("month")}
        >
          This Month
        </button>
      </div>

      {/* Team member list */}
      <div className="team-members-list">
        <div className="team-list-header">
          <span className="col-rank" title="Rank">#</span>
          <span className="col-member" title="Member">Member</span>
          <span className="col-prompts" title="Prompts"><span className="header-full">Prompts</span><span className="header-abbr">Cnt</span></span>
          <span className="col-score" title="Average Score"><span className="header-full">Score</span><span className="header-abbr">Scr</span></span>
          <span className="col-change" title="Change from previous period"><span className="header-full">Change</span><span className="header-abbr">+/-</span></span>
          <span className="col-length" title="Average Prompt Length"><span className="header-full">Length</span><span className="header-abbr">Len</span></span>
        </div>

        {data.members.map((member) => {
          const isCurrentUser = member.userId === data.currentUserId;
          return (
            <div
              key={member.userId}
              className={`team-member-row ${isCurrentUser ? "current-user" : ""}`}
            >
              <span className="col-rank">
                <RankDisplay rank={member.rank} />
              </span>
              <span className="col-member">
                <Avatar url={member.avatarUrl} name={member.name} />
                <span className={`member-name ${isCurrentUser ? "current-user-name" : ""}`} title={member.name}>
                  {member.name}
                </span>
              </span>
              <span className="col-prompts">{member.promptCount}</span>
              <span className="col-score">
                <span className={`team-score ${member.avgScore >= 70 ? "good" : member.avgScore >= 50 ? "medium" : "low"}`}>
                  {member.avgScore.toFixed(0)}
                </span>
              </span>
              <span className="col-change">
                <ScoreChange change={member.scoreChange} />
              </span>
              <span className="col-length">
                {member.avgCharCount > 0 ? `${member.avgCharCount}` : "--"}
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
};
