import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { AppState, Day, Routine, RoutineId } from "#core/index"
import { revision } from "#core/domain/Ids"
import { NO_ORDER } from "#ui/calendarOrder"
import { chosenRoutineIds, routineList, shortDay, weekRows, weekSummary } from "#ui/routineList"
import type { RoutineList, RoutineRow, WeekCell, WeekRow } from "#ui/routineList"
import { monthView } from "#ui/calendarMonth"
import type { DayCell, MonthView } from "#ui/calendarMonth"

const d = (s: string): Day => s as Day
const rutina = (id: string, days: ReadonlyArray<string>, extra: { weeklyGoal?: number; archived?: true } = {}): Routine => ({
  id: id as RoutineId,
  name: id,
  days: days.map(d),
  updatedAt: 0,
  revision: revision("rev"),
  ...extra,
})
const estado = (...rs: ReadonlyArray<Routine>): AppState =>
  ({
    notes: {},
    diagrams: {},
    contexts: {},
    events: {},
    eventGroups: {},
    routines: Object.fromEntries(rs.map((r: Routine): [string, Routine] => [r.id, r])),
  }) as unknown as AppState

/* 2026-07-02 es jueves: su semana va del 29 de junio al 5 de julio. */
const HOY: Day = d("2026-07-02")

describe("routineList", (): void => {
  it("cuenta la semana de hoy y la meta", (): void => {
    const e: AppState = estado(rutina("a", ["2026-06-29", "2026-07-01"], { weeklyGoal: 2 }))
    const l: RoutineList = routineList(e, NO_ORDER, HOY)
    assert.deepEqual(l.visible.map((f: RoutineRow): unknown[] => [f.id, f.done, f.goal, f.met]), [["a", 2, 2, true]])
  })

  it("separa las archivadas y respeta el orden guardado", (): void => {
    const e: AppState = estado(rutina("a", []), rutina("b", []), rutina("c", [], { archived: true }))
    const l: RoutineList = routineList(e, { groups: [], routines: ["b", "a"] }, HOY)
    assert.deepEqual(l.visible.map((f: RoutineRow): string => f.id), ["b", "a"])
    assert.deepEqual(l.archived.map((f: RoutineRow): string => f.id), ["c"])
  })

  it("sin hoy no cuenta la semana", (): void => {
    const l: RoutineList = routineList(estado(rutina("a", ["2026-07-01"])), NO_ORDER, null)
    assert.equal(l.visible[0]?.done, 0)
  })
})

describe("chosenRoutineIds", (): void => {
  it("sólo las visibles encendidas", (): void => {
    const e: AppState = estado(rutina("a", []), rutina("b", [], { archived: true }))
    const l: RoutineList = routineList(e, NO_ORDER, HOY)
    assert.deepEqual([...chosenRoutineIds(l, new Set(["a", "b", "z"]))], ["a"])
  })
})

describe("weekRows", (): void => {
  it("la de hoy primero y hacia atrás, con los días futuros", (): void => {
    const r: Routine = rutina("a", ["2026-06-30", "2026-06-23"], { weeklyGoal: 1 })
    const s: ReadonlyArray<WeekRow> = weekRows(r, HOY, 2)
    assert.deepEqual(s.map((w: WeekRow): unknown[] => [w.first, w.current, w.done, w.met]), [
      ["2026-06-29", true, 1, true],
      ["2026-06-22", false, 1, true],
    ])
    assert.deepEqual(s[0]?.cells.map((c: WeekCell): boolean => c.future), [false, false, false, false, true, true, true])
    assert.deepEqual(s[0]?.cells.map((c: WeekCell): boolean => c.marked), [false, true, false, false, false, false, false])
  })

  it("se corta donde el calendario se acaba", (): void => {
    const s: ReadonlyArray<WeekRow> = weekRows(rutina("a", []), d("0001-01-03"), 5)
    assert.ok(s.length < 5)
  })
})

describe("rótulos", (): void => {
  it("shortDay", (): void => assert.equal(shortDay(d("2026-06-22")), "22/6"))
  it("weekSummary", (): void => {
    assert.equal(weekSummary(3, null, false), "3")
    assert.equal(weekSummary(3, 4, false), "3/4")
    assert.equal(weekSummary(4, 4, true), "4/4 ✓")
  })
})

describe("monthView con rutinas", (): void => {
  it("cuenta por día las elegidas que lo tienen marcado", (): void => {
    const e: AppState = estado(rutina("a", ["2026-07-01"]), rutina("b", ["2026-07-01", "2026-07-02"]))
    const v: MonthView | null = monthView(e, { year: 2026, month: 7 }, HOY, null, new Set(["a", "b"]))
    const dias: ReadonlyArray<DayCell> = v?.weeks.flat() ?? []
    assert.deepEqual(
      dias
        .filter((c: DayCell): boolean => c.day === "2026-07-01" || c.day === "2026-07-02")
        .map((c: DayCell): number[] => [c.routinesDone, c.routinesTotal]),
      [[2, 2], [1, 2]],
    )
  })

  it("sin elegidas no hay progreso", (): void => {
    const e: AppState = estado(rutina("a", ["2026-07-01"]))
    const v: MonthView | null = monthView(e, { year: 2026, month: 7 }, HOY, null)
    assert.ok((v?.weeks.flat() ?? []).every((c: DayCell): boolean => c.routinesTotal === 0 && c.routinesDone === 0))
  })
})
