export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({enemies:2, startingMilk:16, rescueMilk:4, damage:12,
    sight:.8, speed:.82, hearing:.8, staminaDrain:18, staminaRecovery:11, stun:4}),
  normal: Object.freeze({enemies:3, startingMilk:12, rescueMilk:3, damage:20,
    sight:1, speed:1, hearing:1, staminaDrain:23, staminaRecovery:8, stun:3}),
  hard: Object.freeze({enemies:4, startingMilk:8, rescueMilk:2, damage:30,
    sight:1.2, speed:1.16, hearing:1.2, staminaDrain:29, staminaRecovery:6, stun:2.2}),
});

export function getDifficulty(value) {
  return Object.hasOwn(DIFFICULTIES,value) ? value : 'normal';
}
