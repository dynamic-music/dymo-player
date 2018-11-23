import "jasmine";
import { MultiPlayer } from  "../src/players";
import { DummyScheduler } from  "../src/scheduler";
import { getStoreWithDymo } from './util';

describe("a player", () => {
  
  let store;

  beforeEach(async done => {
    store = await getStoreWithDymo();
    done();
  });
  
  it("normally plays sequentially", () => {
    const player = new MultiPlayer(store, new DummyScheduler(0));
    player.play("dymo0");
  });

});