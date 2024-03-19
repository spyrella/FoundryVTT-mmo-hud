import GenericSystem from "../systems/genericSystem.mjs";
import ArchmageSystem from "../systems/ArchmageSystem.mjs";
import DnD5eSystem from "../systems/DND5eSystem.mjs";
import PF2eSystem from "../systems/PF2eSystem.mjs";
import SWADESystem from "../systems/SwadeSystem.mjs";
import FabulaSystem from "../systems/FabulaSystem.mjs";

export default class MMOHUD extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'mmo-hud',
            template: 'modules/mmo-hud/templates/mmo-hud.html',
            popOut: this._getPopOutSettingValue(),
            minimizable: false,
            resizable: false,
            width: 555,
            height: 345,
            classes: ['mmo-hud']
        });
    }

    /* -------------------------------------------- */

    static async init() {
        if (!game.mmoHudInitialized) {
            const instance = new this();
            ui.mmoHud = instance;
            instance.setPosition();
            instance.render(true);
            console.log('MMO HUD | Initialized');
            game.mmoHudInitialized = true;
        }
    }

    /* -------------------------------------------- */

    constructor(options) {
        super(options);
        this.systemConverter = new GenericSystem();
        this.partyIds = [];

        switch (game.system.id) {
            case "archmage":
                this.systemConverter = new ArchmageSystem();
                break;
            case "dnd5e":
                this.systemConverter = new DnD5eSystem();
                break;
            case "pf2e":
                this.systemConverter = new PF2eSystem();
                break;
            case "swade":
                this.systemConverter = new SWADESystem();
                break;
            case "fabulaultima":
                this.systemConverter = new FabulaSystem();
                break;
            default:
                console.log(`MMO HUD | No specific system converter found for ${game.system.id}, using the Generic one.`);
        }
    }

    /* -------------------------------------------- */

    /**
     * Helper function to retrieve the value of the "popOut" setting
     * @returns {boolean} The value of the "popOut" setting or default if not available
     */
    static _getPopOutSettingValue() {
        return game.settings?.settings.has("mmo-hud.popOut") ? game.settings.get("mmo-hud", "popOut") : false;
    }

    /**
     * Set the application position and store its new location.
     * Returns the updated position object for the application containing the new values.
     * @param {{ left: number; top: number; width: number; height: string | number; scale: number }} position
     * @returns {void | { left: number; top: number; width: number; height: number; scale: number }}
     */
    setPosition(position = {}) {
        if (!position.left && !position.top) {
            // Retrieve the position from saved settings.
            position = game.settings.get("mmo-hud", "position");
        }

        // Check if popOut setting is disabled
        if (!this.constructor._getPopOutSettingValue()) {
            const lastSavedPosition = game.settings.get("mmo-hud", "position");
            // Set alternative default position
            position.left = lastSavedPosition?.left || 130;
            position.top = lastSavedPosition?.top || 90;
        }

        // Log position for debugging
        // console.log("Position:", position);

        // Find the mmo-hud-party element
        let mmoHudParty = document.getElementById("mmo-hud-party");

        if (mmoHudParty) {
            // Set the position of mmo-hud-party
            mmoHudParty.style.top = position.top + "px";
            mmoHudParty.style.left = position.left + "px";
        } else {
            console.error("Child element mmo-hud-party not found.");
        }

        if (position) {
            // Save the updated position to settings
            game.settings.set("mmo-hud", "position", position);
            return position;
        } else {
            console.error("Invalid position");
        }
    }
    /* -------------------------------------------- */

    /** @inheritdoc */
    async _renderInner(...args) {
        await loadTemplates({
            characterInfo: 'modules/mmo-hud/templates/character-info.html',
            resourceBar: 'modules/mmo-hud/templates/resource-bar.html',
        });
        return super._renderInner(...args);
    }

    /* -------------------------------------------- */

    /** @override */
    async getData(options) {
        const showMode = game.settings.get("mmo-hud", "showMode");
        let data = await super.getData(options);
        data.hudSize = game.settings.get("mmo-hud", "size");
        data.boxClass = game.settings.get("mmo-hud", "transparentVersion") ? "rpg-title-box" : "rpg-box";
        if (showMode === "always" || (showMode === "combat" && game.combat)) {
            data.party = this._getParty();

            // Calculate percentages
            data.party.forEach((member) => {
                if (member.primary) {
                    const tempWouldExceedMax = member.primary.value + member.primary.temp > member.primary.max;
                    const totalPrimary = tempWouldExceedMax ? (member.primary.value + (member.primary.temp ?? 0)) : member.primary.max;
                    member.primary.percent = Math.round((member.primary.value / totalPrimary) * 100);
                    if (member.primary.temp) {
                        member.primary.bonusPercent = Math.round((member.primary.temp / totalPrimary) * 100);
                        if (member.primary.percent + member.primary.bonusPercent > 100) {
                            member.primary.bonusPercent = 100 - member.primary.percent;
                        }
                    }
                }
                if (member.secondary) {
                    member.secondary.percent = Math.round((member.secondary.value / member.secondary.max) * 100);
                }
            });

            // Determine party size
            data.partySize = this._getPartySize(data.party.length);

            // If any party members have effects, show the effects box
            const showEffects = data.party.some(p => p.effects.length > 0);
            data.party.forEach(p => p.showEffects = showEffects);

            this.partyIds = data.party.map(p => p.id);
        }
        data.enemies = this._getEnemies(data.party?.map(a => a.id) ?? []);

        // Calculate percentages
        data.enemies.forEach((enemy) => {
            if (enemy.primary) {
                const totalPrimary = enemy.primary.max + (enemy.primary.temp ?? 0);
                enemy.primary.percent = Math.round((enemy.primary.value / totalPrimary) * 100);
                if (enemy.primary.temp) {
                    enemy.primary.bonusPercent = Math.round((enemy.primary.temp / totalPrimary) * 100);
                }
            }
        });

        return data;
    }

    /* -------------------------------------------- */

    /**
     * Returns the label for the party size
     * @param {number} size
     * @returns {string}
     * @private
     */
    _getPartySize(size) {
        if (size === 1) return "Solo";
        if (size === 2) return "Duo";
        if (size <= 4) return "Light Party";
        if (size <= 8) return "Full Party";
        return "Alliance";
    }

    /* -------------------------------------------- */

    _getParty() {
        // All actors that are assigned to a Player
        let users = game.users;
        if (game.settings.get("mmo-hud", "partySetup") === "loggedin") {
            users = game.users.filter(u => u.active);
        }
        let party = users.map(u => u.character).filter(c => c);

        // If we are in combat, additionally return all actors with disposition of Friendly
        function _isFriendly(actor) {
            if (actor.token) {
                return actor.token.disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
            }
            else return actor.prototypeToken.disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
        }
        if (game.combat) {
            const friendlyCombatants = game.combat.combatants
                .filter(c => _isFriendly(c.actor))
                .map(c => c.actor);
            party = party.concat(friendlyCombatants);
        }

        party = Array.from([...new Set(party)]);

        // Translate the actor data into the format we need
        let data = party.map(a => this.systemConverter.translatePartyActor(a));

        if (game.combat) {
            data = this.systemConverter.setInitiatives(data);
        }
        return data;
    }

    /* -------------------------------------------- */

    _getMockPartyData() {
        return [{
            id: "y2rIVgjNt6EAU0cY",
            name: 'Mr. Dragonborn',
            level: 5,
            image: 'systems/archmage/assets/icons/tokens/monsters/dragon-red.webp',
            primary: {
                name: "Health",
                value: 10,
                max: 18,
                theme: "rpg-t-hp"
            },
            secondary: {
                name: "Recoveries",
                value: 3,
                max: 8,
                theme: "rpg-t-mp"
            },
            effects: [
                {
                    name: "Blessed",
                    icon: "systems/archmage/assets/icons/skills/emerald_01.jpg",
                    isBuff: true
                },
                {
                    name: "Affliction",
                    icon: "systems/archmage/assets/icons/skills/affliction_01.jpg",
                    isDebuff: true
                },
                {
                    name: "Red Crystal",
                    icon: "systems/archmage/assets/icons/skills/blood_01.jpg",
                }
            ]
        },
        {
            id: "y2rIVgjNt6EAU0cY",
            name: 'T. Fling',
            level: 5,
            image: 'systems/archmage/assets/icons/tokens/monsters/demon.webp',
            primary: {
                name: "Health",
                value: 15,
                max: 18,
                theme: "rpg-t-hp"
            },
            secondary: {
                name: "Recoveries",
                value: 6,
                max: 8,
                theme: "rpg-t-mp"
            },
            effects: [
                {
                    name: "Blessed",
                    icon: "systems/archmage/assets/icons/skills/emerald_01.jpg",
                    isBuff: true
                },
                {
                    name: "Affliction",
                    icon: "systems/archmage/assets/icons/skills/affliction_01.jpg",
                    isDebuff: true
                },
                {
                    name: "Red Crystal",
                    icon: "systems/archmage/assets/icons/skills/blood_01.jpg",
                }
            ]
        }];
    }

    /* -------------------------------------------- */

    _getEnemies(partyIds) {
        if (!canvas?.scene) return [];

        const targeted = Array.from(game.user.targets
            .filter(t => !partyIds.includes(t.document.actor._id))
            .map(t => t.document));
        const boss = canvas.scene.tokens.filter(t => t.flags["mmo-hud"] && t.flags["mmo-hud"]["boss"] === true);
        let enemies = targeted.concat(boss);
        enemies = enemies.filter((v, i, a) => a.findIndex(t => (t._id === v._id)) === i);

        return enemies.map(t => this.systemConverter.translateEnemyToken(t));
    }

    /* -------------------------------------------- */

    _getMockEnemiesData() {
        return [
            {
                id: "y2rIVgjNt6EAU0cY",
                name: "Big, Bad, Evil Guy",
                level: 5,
                primary: {
                    name: "Health",
                    value: 18,
                    max: 20,
                },
                effects: [
                    {
                        name: "Blessed",
                        icon: "systems/archmage/assets/icons/skills/emerald_01.jpg",
                        isBuff: true
                    },
                    {
                        name: "Affliction",
                        icon: "systems/archmage/assets/icons/skills/affliction_01.jpg",
                        isDebuff: true
                    },
                    {
                        name: "Red Crystal",
                        icon: "systems/archmage/assets/icons/skills/blood_01.jpg",
                    }
                ]
            },
            {
                id: "y2rIVgjNt6EAU0cY",
                name: "Smaller, Bad, Evil Guy",
                level: 5,
                primary: {
                    name: "Health",
                    value: 5,
                    max: 10,
                },
                effects: [
                    {
                        name: "Blessed",
                        icon: "systems/archmage/assets/icons/skills/emerald_01.jpg",
                        isBuff: true
                    }
                ]
            }
        ];
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        html.find(".rpg-nav-a").click(this._onCharacterTarget.bind(this));

        // Listen for double click events on character portraits
        html.find(".rpg-nav-a").on('dblclick', this._onCharacterPortraitDoubleClick.bind(this));

        // Prevent closing the window when the escape key is pressed
        $(document).keydown(event => {
            if (event.key === 'Escape' && this.element[0].style.display !== 'none') {
                event.preventDefault();
                event.stopPropagation();
            }
        });
    }

    /* -------------------------------------------- */

    _onCharacterTarget(event) {
        event.preventDefault();
        const actorId = event.currentTarget.dataset.documentId;
        const actor = game.actors.get(actorId);

        if (!actor) return;

        const activeTokenIds = actor.getActiveTokens().map(t => t.id);
        const currentTargets = game.user.targets.ids;

        if (event.shiftKey) {
            // Toggle target selection with shift key
            if (game.user.targets.ids.includes(activeTokenIds[0])) {
                const newTargets = currentTargets.filter(id => id !== activeTokenIds[0]);
                game.user.updateTokenTargets(newTargets);
            } else {
                game.user.updateTokenTargets(currentTargets.concat(activeTokenIds));
            }
        } else {
            // Regular click selects the target
            game.user.updateTokenTargets(activeTokenIds, { releaseOthers: true });
        }
    }

    _onCharacterPortraitDoubleClick(event) {
        event.preventDefault();

        // Retrieve the actor ID associated with the clicked portrait
        const actorId = $(event.currentTarget).closest(".rpg-nav-a").data('document-id');

        console.log('Actor ID:', actorId); // Debug

        // If an actor ID is found, open the character sheet
        if (actorId) {
            const actor = game.actors.get(actorId);
            console.log('Actor:', actor); // Debug

            if (actor) {
                actor.sheet.render(true);
                console.log('Character sheet rendered.'); // Debug
            } else {
                console.error(`Actor with ID ${actorId} not found.`);
            }
        } else {
            console.error("Actor ID not found.");
        }
    }
}



Hooks.on('getSceneControlButtons', (buttons) => {
    if (game.user.isGM) {
        const mmoHudControl = {
            activeTool: "openMMOHudButton", // Assuming you have a tool with this name
            icon: "fas fa-chart-line",
            layer: "controls",
            name: "openMMOHudButton",
            title: "Open MMO HUD",
            tools: [
                {
                    name: "openMMOHudButton",
                    icon: "fas fa-chart-line",
                    title: "Toggle MMO HUD",
                    button: true,
                    onClick: toggleMMOHud
                }
            ],
            visible: true
        };

        buttons.push(mmoHudControl);
    }
});

function toggleMMOHud() {
    // Toggle the MMO HUD sheet
    if (ui.mmoHud) {
        if (ui.mmoHud.rendered) {
            ui.mmoHud.close();
        } else {
            ui.mmoHud.render(true);
        }
    } else {
        console.error("MMO HUD instance not found.");
    }
}
