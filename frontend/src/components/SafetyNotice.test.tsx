import { render, screen } from '@testing-library/react'
import { SafetyNotice } from './SafetyNotice'
import { describe, expect, it } from 'vitest'
describe('SafetyNotice', () => it('states that the app does not diagnose', () => { render(<SafetyNotice />); expect(screen.getByText(/does not diagnose/i)).toBeInTheDocument() }))
