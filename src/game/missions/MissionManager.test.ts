import { describe, expect, it, vi } from 'vitest';
import { MissionManager, OBJECTIVES } from './MissionManager';

describe('Blacksite 07 mission progression', () => {
  it('completes the mission through its playable route and reports each objective', () => {
    const changed = vi.fn();
    const mission = new MissionManager(changed);
    expect(mission.text).toBe(OBJECTIVES[0]);
    mission.enterArea(4);
    expect(mission.stage).toBe(1);
    expect(mission.acquireKey()).toBe(true);
    expect(mission.stage).toBe(2);
    mission.enterArea(-62);
    expect(mission.stage).toBe(3);
    expect(mission.acquireData()).toBe(true);
    expect(mission.stage).toBe(4);
    expect(mission.extract()).toBe(true);
    expect(mission.stage).toBe(5);
    expect(mission.completed).toBe(true);
    expect(mission.hasData).toBe(true);
    expect(mission.text).toBe(OBJECTIVES[5]);
    expect(changed).toHaveBeenCalledTimes(5);
  });

  it('does not grant the data or extraction out of order or advance from location alone', () => {
    const mission = new MissionManager(vi.fn());
    expect(mission.acquireData()).toBe(false);
    expect(mission.extract()).toBe(false);
    mission.enterArea(-70);
    expect(mission.stage).toBe(1);
    expect(mission.hasKey).toBe(false);
    expect(mission.acquireData()).toBe(false);
    mission.acquireKey();
    expect(mission.acquireData()).toBe(false);
    expect(mission.extract()).toBe(false);
    mission.enterArea(-62);
    expect(mission.acquireData()).toBe(true);
  });

  it('makes repeated pickups, area triggers and extraction idempotent', () => {
    const changed = vi.fn();
    const mission = new MissionManager(changed);
    mission.enterArea(0);
    mission.enterArea(0);
    mission.acquireKey();
    expect(mission.acquireKey()).toBe(false);
    mission.enterArea(-62);
    mission.enterArea(-70);
    mission.acquireData();
    expect(mission.acquireData()).toBe(false);
    mission.extract();
    expect(mission.extract()).toBe(false);
    mission.enterArea(10);
    expect(mission.stage).toBe(5);
    expect(changed).toHaveBeenCalledTimes(5);
  });

  it('resets all credentials and completion so a second run requires the mission again', () => {
    const mission = new MissionManager(vi.fn());
    mission.enterArea(0);
    mission.acquireKey();
    mission.enterArea(-62);
    mission.acquireData();
    mission.extract();
    mission.reset();
    expect([mission.stage, mission.hasKey, mission.hasData, mission.completed]).toEqual([0, false, false, false]);
    expect(mission.acquireData()).toBe(false);
    expect(mission.extract()).toBe(false);
    mission.enterArea(0);
    expect(mission.acquireKey()).toBe(true);
    mission.enterArea(-62);
    expect(mission.acquireData()).toBe(true);
    expect(mission.extract()).toBe(true);
  });
});
