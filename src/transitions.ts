import { DymoGenerator, ExpressionGenerator, uris } from 'dymo-core';
import { DymoPlayer } from './main';

export class Transitions {

  private generator: DymoGenerator;
  private expressionGen: ExpressionGenerator;

  constructor(private player: DymoPlayer) {
    const store = player.getDymoManager().getStore();
    this.generator = new DymoGenerator(true, store);
    this.expressionGen = new ExpressionGenerator(store);
  }

  async transitionToUri(toUri: string, fromUri: string, duration: number) {
    const fadeRamp = await this.generator.addRampControl(0, duration, 100);
    const fadeOut = await this.makeSetsConstraint(toUri,
      [['d',[fromUri]], ['r',[fadeRamp]]], 'Amplitude(d) == 1-r');
    const fadeIn = await this.makeSetsConstraint(toUri,
      [['d',[toUri]], ['r',[fadeRamp]]], 'Amplitude(d) == r');
    const mng = this.player.getDymoManager();
    await mng.loadFromStore(fadeRamp, fadeIn, fadeOut);
    await mng.getStore().setControlParam(fadeRamp, uris.AUTO_CONTROL_TRIGGER, 1);
  }

  private makeSetsConstraint(ownerUri: string, sets: [string,string[]][], expression: string): Promise<string> {
    let vars = sets.map(s => '∀ '+s[0]+' in '+JSON.stringify(s[1])+' => ').join('');
    return this.expressionGen.addConstraint(ownerUri, vars+expression, true);
  }

}