export type UUID = string;
export type ISODateString = string;

export interface EntityMetadata {
  created_at: ISODateString;
  updated_at: ISODateString;
  version: number;
}
