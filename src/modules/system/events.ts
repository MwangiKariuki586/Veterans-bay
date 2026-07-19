export const systemDomainEventTypes = [] as const;

export type SystemDomainEvent = (typeof systemDomainEventTypes)[number];
