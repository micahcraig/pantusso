declare module '@micahcraig/ebbets' {
  export type EbbetsPlayer = {
    id:       string | number
    name:     string
    position: string   // field position code or '' for unassigned
    color:    string
  }

  export type EbbetsLineup = {
    outfield?:  '3' | '4'
    manualEH?:  boolean
  }

  export type EbbetsState = {
    players: EbbetsPlayer[]
    lineup:  EbbetsLineup
  }

  export type LineupManagerProps = {
    players?:        EbbetsPlayer[]
    lineup?:         EbbetsLineup
    onLineupChange?: (state: EbbetsState) => void
    initialView?:    'lineup' | 'field'
    showTitle?:      boolean
  }

  export function LineupManager(props: LineupManagerProps): JSX.Element
}
