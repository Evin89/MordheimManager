import { CAMPAIGN_SCHEMA_VERSION, Campaign, WARBAND_SCHEMA_VERSION, Warband } from '../types';

// Migration steps are keyed by the version they migrate *from*.
// Add a new entry (e.g. `1: (data) => ({ ...data, newField: default }))`)
// whenever WARBAND_SCHEMA_VERSION / CAMPAIGN_SCHEMA_VERSION is bumped.

type RawRecord = Record<string, unknown>;
type Migration = (data: RawRecord) => RawRecord;

const warbandMigrations: Record<number, Migration> = {
  0: (data) => ({ ...data }),
};

const campaignMigrations: Record<number, Migration> = {
  0: (data) => ({ ...data }),
};

function runMigrations(
  raw: RawRecord,
  targetVersion: number,
  migrations: Record<number, Migration>,
  entityName: string,
): RawRecord {
  let data = raw;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  while (version < targetVersion) {
    const migrate = migrations[version];
    if (!migrate) {
      throw new Error(`No migration path for ${entityName} from schema version ${version}`);
    }
    data = migrate(data);
    version += 1;
  }

  return { ...data, schemaVersion: targetVersion };
}

export function migrateWarband(raw: unknown): Warband {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Warband data is not an object');
  }
  return runMigrations(raw as RawRecord, WARBAND_SCHEMA_VERSION, warbandMigrations, 'warband') as unknown as Warband;
}

export function migrateCampaign(raw: unknown): Campaign {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Campaign data is not an object');
  }
  return runMigrations(raw as RawRecord, CAMPAIGN_SCHEMA_VERSION, campaignMigrations, 'campaign') as unknown as Campaign;
}
