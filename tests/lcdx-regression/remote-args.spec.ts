import { expect, test } from '@playwright/test';
import { ok, setup } from './fixture';

interface CommandBody {
  userName: string;
  nickName: string;
  command: string;
  message: string;
}

/**
 * 页③ 远程控制的参数契约回归（2026-11-02）：
 * printscr 可选 0/1/2、remote-card 必填 20 位卡号、download/downloadpro 为「存储位置|下载URL」、
 * 无参指令禁用参数框且下发空串、切换指令按参数格式清空已填值。
 */

async function openPage(page: import('@playwright/test').Page) {
  const bodies: CommandBody[] = [];
  await page.route('**/lcdx/cabinet/command', route => {
    bodies.push(route.request().postDataJSON() as CommandBody);
    return route.fulfill({ json: ok({ requestId: `req-${bodies.length}` }) });
  });
  // 回执立即 done，避免轮询定时器在用例之间空转
  await page.route('**/lcdx/cabinet/result/**', route =>
    route.fulfill({ json: ok({ status: 'done', command: 'any', message: null, imageUrl: null }) }),
  );
  await page.goto('/mai2/remotecontrol');
  await expect(page.locator('select#remote-cabinet')).toHaveValue('Cabinet A');
  return {
    bodies,
    command: page.locator('select#remote-command'),
    params: page.locator('input#remote-params'),
    hint: page.locator('#remote-args-hint'),
    error: page.locator('#remote-args-error'),
    send: page.getByRole('button', { name: 'Send', exact: true }),
  };
}

test('remote args follow the per-command contract', async ({ page }) => {
  await setup(page);
  const ui = await openPage(page);

  // 无参指令：参数框禁用、下发空串
  await ui.command.selectOption('ping');
  await expect(ui.params).toBeDisabled();
  await expect(ui.hint).toHaveText('This command takes no argument');
  await ui.send.click();
  await expect.poll(() => ui.bodies.at(-1)?.message).toBe('');

  // printscr：可输入，提示与 placeholder 都标明可选 + 取值 0/1/2；留空可发
  await ui.command.selectOption('printscr');
  await expect(ui.params).toBeEnabled();
  await expect(ui.hint).toHaveText('Arg: 0 / 1 / 2 (optional)');
  await expect(ui.params).toHaveAttribute('placeholder', '0 / 1 / 2 (optional)');
  await ui.send.click();
  await expect.poll(() => ui.bodies.at(-1)?.message).toBe('');
  await expect.poll(() => ui.bodies.at(-1)?.command).toBe('printscr');

  // printscr 非法取值：行内报错且不发请求
  await ui.params.fill('9');
  await ui.params.blur();
  await expect(ui.error).toHaveText('Only 0 / 1 / 2; may be empty');
  await expect(ui.params).toHaveClass(/is-invalid/);
  const afterPrintscr = ui.bodies.length;
  await ui.send.click();
  await page.waitForTimeout(300);
  expect(ui.bodies.length).toBe(afterPrintscr);

  // printscr 合法取值
  await ui.params.fill('2');
  await ui.send.click();
  await expect.poll(() => ui.bodies.at(-1)?.message).toBe('2');

  // download / downloadpro：提示改为「存储位置|下载URL」，且两者共享同一参数格式
  await ui.command.selectOption('download');
  await expect(ui.hint).toHaveText('Arg: save location|download URL');
  await expect(ui.params).toHaveAttribute('placeholder', 'Save location|download URL');
  await expect(ui.params).toHaveValue('');
  await ui.params.fill('D:\\dl|x');
  await ui.command.selectOption('downloadpro');
  await expect(ui.params).toHaveValue('D:\\dl|x');

  // 切到无参指令：清空并禁用，残留值不发送
  await ui.command.selectOption('game-reboot');
  await expect(ui.params).toBeDisabled();
  await expect(ui.params).toHaveValue('');
  const beforeReboot = ui.bodies.length;
  await ui.send.click();
  await expect.poll(() => ui.bodies.length).toBe(beforeReboot + 1);
  expect(ui.bodies.at(-1)?.message).toBe('');
  expect(ui.bodies.at(-1)?.command).toBe('game-reboot');
});

test('remote-card requires a 20-digit card number', async ({ page }) => {
  await setup(page);
  const ui = await openPage(page);

  // 先填一个非卡号值，验证切换指令时按参数格式清空
  await ui.command.selectOption('printscr');
  await ui.params.fill('2');
  await ui.command.selectOption('remote-card');
  await expect(ui.params).toHaveValue('');

  await expect(ui.params).toBeEnabled();
  await expect(ui.hint).toHaveText('Arg: 20-digit card number (required)');
  await expect(ui.params).toHaveAttribute('placeholder', 'Required, 20-digit card number');

  // 空值：点击发送不发请求，行内报错
  const before = ui.bodies.length;
  await ui.send.click();
  await expect(ui.error).toHaveText('Required, 20-digit card number');
  await page.waitForTimeout(300);
  expect(ui.bodies.length).toBe(before);

  // 19 位：仍不发请求
  await ui.params.fill('1234567890123456789');
  await ui.params.blur();
  await ui.send.click();
  await page.waitForTimeout(300);
  expect(ui.bodies.length).toBe(before);

  // 20 位（含从别处粘来的分组空格）：归一化后下发纯数字
  await ui.params.fill('1234 5678 9012 3456 7890');
  await expect(ui.error).toHaveCount(0);
  await ui.send.click();
  await expect.poll(() => ui.bodies.length).toBe(before + 1);
  expect(ui.bodies.at(-1)?.message).toBe('12345678901234567890');
  expect(ui.bodies.at(-1)?.command).toBe('remote-card');
});
