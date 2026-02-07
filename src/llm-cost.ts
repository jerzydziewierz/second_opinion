// Cost calculation has been removed as per requirements
// CLI mode doesn't provide usage data for cost calculation

export function calculateCost(): {
  inputCost: number
  outputCost: number
  totalCost: number
} {
  return { inputCost: 0, outputCost: 0, totalCost: 0 }
}
