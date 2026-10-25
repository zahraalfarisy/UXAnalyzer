import { useId } from 'react'
import { ChevronDown } from 'lucide-react'

export default function StepAccordion({ steps }) {
  const group = useId()
  return <div className="step-accordion">
    {steps.map((step, index) => <details key={step.title} name={group} open={index === 0}>
      <summary>
        <span className="step-number" aria-hidden="true">{index + 1}</span>
        <h3 className="card-title">{step.title}</h3>
        <ChevronDown size={18} className="step-chevron" aria-hidden="true" />
      </summary>
      <div className="step-content"><p className="supporting-copy">{step.description}</p></div>
    </details>)}
  </div>
}
