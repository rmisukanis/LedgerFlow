// How an outside-deposit template is stored. The Outside Deposits page only sends the template name.
export type OutsideDepositTemplate = {
  name: string
  depositType: string
}

export const OUTSIDE_DEPOSIT_TEMPLATES: Record<string, OutsideDepositTemplate> = {
  Venmo: {
    name: "Venmo",
    depositType: "Standard Transfer",
  },
}
