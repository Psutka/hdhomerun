export interface DeviceInfo {
  FriendlyName: string;
  ModelNumber: string;
  FirmwareVersion: string;
  FirmwareName: string;
  DeviceID: string;
  DeviceAuth: string;
  BaseURL: string;
  LineupURL: string;
  StorageURL?: string;
}

export interface Channel {
  GuideNumber: string;
  GuideName: string;
  VideoCodec?: string;
  AudioCodec?: string;
  HD?: number;
  Favorite?: number;
  URL: string;
}

export interface GuideProgram {
  Title: string;
  EpisodeTitle?: string;
  Synopsis?: string;
  StartTime: number;
  EndTime: number;
  ImageURL?: string;
  Filter?: string[];
  SeriesID?: string;
  EpisodeNumber?: string;
  OriginalAirdate?: number;
  RecordingRule?: number;
  RecordingInProgress?: number;
}

export interface GuideChannel {
  GuideNumber: string;
  GuideName: string;
  Affiliate?: string;
  ImageURL?: string;
  Guide: GuideProgram[];
}

// Top-level entry returned by /recorded_files.json
export interface RecordingSeries {
  SeriesID: string;
  Title: string;
  Category?: string;
  ImageURL?: string;
  StartTime?: number;
  New?: number;
  EpisodesURL: string;
}

// Individual episode returned by EpisodesURL
export interface RecordingEpisode {
  SeriesID?: string;
  Title?: string;
  EpisodeTitle?: string;
  EpisodeNumber?: string;
  Synopsis?: string;
  StartTime: number;
  EndTime?: number;
  RecordDuration?: number;
  RecordFileSize?: number;
  ChannelName?: string;
  ChannelNumber?: string;
  ImageURL?: string;
  PlayURL: string;
  CmdURL?: string;
  OriginalAirdate?: number;
}

export interface ScheduledItem {
  ProgramID: string;
  Title: string;
  EpisodeTitle?: string;
  Synopsis?: string;
  StartTime: number;
  EndTime: number;
  ChannelName?: string;
  ChannelNumber?: string;
  ImageURL?: string;
  SeriesID?: string;
  EpisodeNumber?: string;
  RecordingRuleID?: string;
}

export interface RecordingRule {
  RecordingRuleID: string;
  SeriesID: string;
  Title: string;
  Synopsis?: string;
  ImageURL?: string;
  ChannelOnly?: string;
  AfterOriginalAirdateOnly?: number;
  RecentOnly?: number;
  KeepUpTo?: number;
  DateTimeOnly?: number;
  Priority?: number;
  StartPadding?: number;
  EndPadding?: number;
}

export interface RecordingRuleInput {
  SeriesID: string;
  ChannelOnly?: string;
  AfterOriginalAirdateOnly?: number;
  RecentOnly?: number;
  KeepUpTo?: number;
  DateTimeOnly?: number;
  StartPadding?: number;
  EndPadding?: number;
}

export interface StreamInfo {
  url: string;
  channelName: string;
  channelNumber: string;
}
