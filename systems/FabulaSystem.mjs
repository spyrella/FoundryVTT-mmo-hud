import GenericSystem from "./genericSystem.mjs";

export default class FabulaSystem extends GenericSystem {

    /* -------------------------------------------- */

    /** @override */
    translateResourceBar(actor, barAttribute) {
        let data = super.translateResourceBar(actor, barAttribute);
        switch ( barAttribute ) {
            case "resources.hp": data.name = "HP"; break;
            case "resources.mp": data.name = "MP"; break;
        }
        return data;
    }

    /* -------------------------------------------- */

    /** @override */
    translatePartyActor(actor) {
        let data = super.translatePartyActor(actor);
        data.level = actor.system.level.value;
        return data;
    }
}
