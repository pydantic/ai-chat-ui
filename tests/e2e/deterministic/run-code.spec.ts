import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { toolCard } from '../tools'

test.describe('run_code', () => {
  test('shows the run_code tool card', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'run-code', 'Run some code')
    await expect(toolCard(page, 'run_code')).toBeVisible()
  })

  test('renders the Python code, stdout, and result', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'run-code', 'Run some code')

    const card = toolCard(page, 'run_code')
    await expect(card.getByText('Completed')).toBeVisible()

    // The card's content is collapsed until the user clicks the header. Opening
    // it reveals RunCodeInput (the "Code" block) and RunCodeOutput (the
    // "Output"/"Result" sections).
    await card.getByRole('button', { name: /run_code/ }).click()

    // RunCodeInput renders the `code` field as a Python CodeBlock. The
    // SyntaxHighlighter splits the source across token spans, so anchor with
    // `.first()`.
    await expect(card.getByRole('heading', { name: 'Code' })).toBeVisible()
    await expect(card.getByText("print('hello world')").first()).toBeVisible()

    // RunCodeOutput renders stdout under "Output" and the JSON result under
    // "Result".
    await expect(card.getByRole('heading', { name: 'Output' })).toBeVisible()
    await expect(card.getByText('hello world').first()).toBeVisible()
    await expect(card.getByRole('heading', { name: 'Result' })).toBeVisible()

    await expect(page.getByText('The code ran successfully.')).toBeVisible()
  })
})
