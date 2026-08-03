"use client";

import { CalendarOff, Clock3, Plus, Trash2, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { DetailPageSkeleton } from "@/components/ui/workspace-skeletons";
import type { AvailabilityConfiguration } from "@/modules/bookings/types";
import {
  addAvailabilityBlock,
  getAvailability,
  removeAvailabilityBlock,
  saveAvailability,
} from "./booking-api";

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function AvailabilitySettings() {
  const [configuration, setConfiguration] =
    useState<AvailabilityConfiguration | null>(null);
  const [membershipId, setMembershipId] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [timezone, setTimezone] = useState("Africa/Nairobi");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAvailability()
      .then((result) => {
        setConfiguration(result);
        const initialMembershipId = result.members[0]?.membershipId ?? "";
        setMembershipId(initialMembershipId);
        applyMemberRules(
          result.rules.filter(
            (rule) => rule.membershipId === initialMembershipId,
          ),
        );
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Availability unavailable.",
        ),
      );
  }, []);

  function applyMemberRules(
    rules: AvailabilityConfiguration["rules"],
  ) {
    if (rules.length === 0) {
      setSelectedDays([1, 2, 3, 4, 5]);
      setStartTime("08:00");
      setEndTime("17:00");
      return;
    }
    setSelectedDays([...new Set(rules.map((rule) => rule.weekday))]);
    setStartTime(minutesToTime(rules[0].startMinute));
    setEndTime(minutesToTime(rules[0].endMinute));
    setTimezone(rules[0].timezone);
  }

  function selectMember(nextMembershipId: string) {
    setMembershipId(nextMembershipId);
    applyMemberRules(
      configuration?.rules.filter(
        (rule) => rule.membershipId === nextMembershipId,
      ) ?? [],
    );
  }

  async function saveHours() {
    if (!membershipId) return;
    setBusy("hours");
    setError(null);
    try {
      setConfiguration(
        await saveAvailability({
          membershipId,
          timezone,
          rules: selectedDays.map((weekday) => ({
            weekday,
            startMinute: timeToMinutes(startTime),
            endMinute: timeToMinutes(endTime),
          })),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hours were not saved.");
    } finally {
      setBusy(null);
    }
  }

  async function addBlock() {
    if (!membershipId || !blockStart || !blockEnd) return;
    setBusy("block");
    setError(null);
    try {
      setConfiguration(
        await addAvailabilityBlock({
          membershipId,
          startsAt: new Date(blockStart).toISOString(),
          endsAt: new Date(blockEnd).toISOString(),
          reason: blockReason,
        }),
      );
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unavailable time was not saved.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function removeBlock(blockId: string) {
    setBusy(blockId);
    setError(null);
    try {
      setConfiguration(await removeAvailabilityBlock(blockId));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unavailable time was not removed.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!configuration && !error) {
    return <DetailPageSkeleton />;
  }

  const memberBlocks =
    configuration?.blocks.filter(
      (block) => block.membershipId === membershipId,
    ) ?? [];

  return (
    <div>
      <div>
        <p className="text-sm font-semibold text-[#5f8d11]">
          Scheduling rules
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-title">
          Professional availability
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
          Working hours and unavailable periods determine the slots clients and
          dispatchers can choose. Confirmed reservations remain protected by
          the database.
        </p>
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Availability needs attention"
          description={error}
        />
      ) : null}

      {configuration ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Surface className="p-5 shadow-none sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Clock3 className="size-5 text-[#5f8d11]" /> Working hours
            </h2>
            {configuration.members.length === 0 ? (
              <StatePanel
                className="mt-5"
                title="No assignable team members"
                description="Add an active organisation member before publishing working hours."
              />
            ) : (
              <>
                <label className="mt-5 block text-sm font-semibold">
                  Team member
                  <select
                    className="mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-3 font-normal"
                    value={membershipId}
                    onChange={(event) => selectMember(event.target.value)}
                  >
                    {configuration.members.map((member) => (
                      <option
                        key={member.membershipId}
                        value={member.membershipId}
                      >
                        {member.displayName} · {member.roleName}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="mt-5">
                  <legend className="text-sm font-semibold">Working days</legend>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {weekdays.map((day, weekday) => (
                      <label
                        key={day}
                        className="flex min-h-11 items-center gap-2 rounded-xl border border-black/8 px-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDays.includes(weekday)}
                          onChange={(event) =>
                            setSelectedDays((current) =>
                              event.target.checked
                                ? [...current, weekday].sort()
                                : current.filter((item) => item !== weekday),
                            )
                          }
                        />
                        {day.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <label className="text-sm font-semibold">
                    Start
                    <input
                      className="mt-2 h-12 w-full rounded-xl border border-black/10 px-3 font-normal"
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    End
                    <input
                      className="mt-2 h-12 w-full rounded-xl border border-black/10 px-3 font-normal"
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Timezone
                    <input
                      className="mt-2 h-12 w-full rounded-xl border border-black/10 px-3 font-normal"
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                    />
                  </label>
                </div>
                <Button
                  className="mt-5"
                  loading={busy === "hours"}
                  disabled={
                    selectedDays.length === 0 ||
                    timeToMinutes(endTime) <= timeToMinutes(startTime)
                  }
                  onClick={() => void saveHours()}
                >
                  Save working hours
                </Button>
              </>
            )}
          </Surface>

          <aside className="space-y-5">
            <Surface className="p-5 shadow-none">
              <h2 className="flex items-center gap-2 font-bold">
                <CalendarOff className="size-4 text-[#5f8d11]" />
                Add unavailable time
              </h2>
              <label className="mt-4 block text-sm font-semibold">
                Starts
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3 font-normal"
                  type="datetime-local"
                  value={blockStart}
                  onChange={(event) => setBlockStart(event.target.value)}
                />
              </label>
              <label className="mt-4 block text-sm font-semibold">
                Ends
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3 font-normal"
                  type="datetime-local"
                  value={blockEnd}
                  onChange={(event) => setBlockEnd(event.target.value)}
                />
              </label>
              <label className="mt-4 block text-sm font-semibold">
                Reason
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3 font-normal"
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value)}
                  placeholder="Leave, travel, equipment maintenance"
                />
              </label>
              <Button
                className="mt-4 w-full"
                variant="outline"
                loading={busy === "block"}
                disabled={
                  !membershipId ||
                  !blockStart ||
                  !blockEnd ||
                  blockReason.trim().length < 3
                }
                onClick={() => void addBlock()}
              >
                <Plus className="size-4" /> Add unavailable time
              </Button>
            </Surface>

            <Surface className="p-5 shadow-none">
              <h2 className="flex items-center gap-2 font-bold">
                <UsersRound className="size-4 text-[#5f8d11]" />
                Upcoming unavailable periods
              </h2>
              {memberBlocks.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-[#68717b]">
                  No future blocks for this team member.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {memberBlocks.map((block) => (
                    <li
                      key={block.id}
                      className="rounded-xl border border-black/8 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{block.reason}</p>
                          <p className="mt-1 text-xs leading-5 text-[#68717b]">
                            {new Date(block.startsAt).toLocaleString()} –{" "}
                            {new Date(block.endsAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${block.reason}`}
                          disabled={busy === block.id}
                          onClick={() => void removeBlock(block.id)}
                          className="grid size-9 shrink-0 place-items-center rounded-full text-danger hover:bg-danger-soft disabled:opacity-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}
