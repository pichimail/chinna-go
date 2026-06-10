#!/usr/bin/env python3
"""
Chinna TUI — Futuristic Interactive CLI
Inspired by Grok CLI and Claude Code style
Keyboard-driven, beautiful visuals, dynamic feature access
"""
import curses
import time
import subprocess
import sys

def draw_box(stdscr, y, x, h, w, title=""):
    stdscr.attron(curses.color_pair(1))
    stdscr.addstr(y, x, "┌" + "─" * (w-2) + "┐")
    for i in range(1, h-1):
        stdscr.addstr(y+i, x, "│" + " " * (w-2) + "│")
    stdscr.addstr(y+h-1, x, "└" + "─" * (w-2) + "┘")
    if title:
        stdscr.addstr(y, x+2, f" {title} ")
    stdscr.attroff(curses.color_pair(1))

def main(stdscr):
    curses.curs_set(0)
    curses.start_color()
    curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK)
    curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)
    curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)
    curses.init_pair(4, curses.COLOR_RED, curses.COLOR_BLACK)
    curses.init_pair(5, curses.COLOR_MAGENTA, curses.COLOR_BLACK)

    stdscr.clear()
    h, w = stdscr.getmaxyx()

    # Header
    stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
    stdscr.addstr(0, 0, " CHINNA v6.5  —  Futuristic Interactive CLI ".center(w))
    stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)
    stdscr.addstr(1, 0, "━" * w)

    # Menu
    menu_items = [
        ("1", "Doctor — Full system health check"),
        ("2", "Clean — Deep clean with visual progress"),
        ("3", "WhatsApp — Open WhatsApp bridge status"),
        ("4", "Dashboard — Launch web dashboard"),
        ("5", "AI Chat — Quick AI prompt"),
        ("6", "Music — Control Apple Music"),
        ("7", "Browser Tools — Open extension panel"),
        ("q", "Quit"),
    ]

    selected = 0

    while True:
        stdscr.clear()
        draw_box(stdscr, 2, 2, len(menu_items)+4, w-4, " MAIN MENU ")

        for idx, (key, label) in enumerate(menu_items):
            y = 4 + idx
            if idx == selected:
                stdscr.attron(curses.color_pair(2) | curses.A_BOLD)
                stdscr.addstr(y, 5, f"▶ {key}. {label}")
                stdscr.attroff(curses.color_pair(2) | curses.A_BOLD)
            else:
                stdscr.addstr(y, 5, f"  {key}. {label}")

        stdscr.addstr(h-3, 2, " Use ↑↓ to navigate • Enter to select • q to quit ")
        stdscr.refresh()

        key = stdscr.getch()

        if key == curses.KEY_UP and selected > 0:
            selected -= 1
        elif key == curses.KEY_DOWN and selected < len(menu_items)-1:
            selected += 1
        elif key in [curses.KEY_ENTER, 10, 13]:
            choice = menu_items[selected][0]
            stdscr.clear()
            if choice == "q":
                break
            elif choice == "1":
                stdscr.addstr(4, 4, "Running chinna doctor...")
                stdscr.refresh()
                subprocess.run(["chinna", "doctor"])
            elif choice == "2":
                stdscr.addstr(4, 4, "Starting deep clean...")
                stdscr.refresh()
                subprocess.run(["chinna", "clean"])
            elif choice == "3":
                stdscr.addstr(4, 4, "Opening WhatsApp status...")
                stdscr.refresh()
                subprocess.run(["chinna", "bot"])
            elif choice == "4":
                stdscr.addstr(4, 4, "Launching dashboard...")
                stdscr.refresh()
                subprocess.run(["chinna", "dashboard"])
            elif choice == "5":
                stdscr.addstr(4, 4, "Type your prompt below:")
                stdscr.refresh()
                # Simple prompt input
                curses.echo()
                prompt = stdscr.getstr(6, 4, 60).decode()
                curses.noecho()
                subprocess.run(["chinna", "ai", prompt])
            elif choice == "6":
                subprocess.run(["chinna", "music", "playpause"])
            elif choice == "7":
                stdscr.addstr(4, 4, "Open ~/.chinna/extension in Chrome (Load unpacked)")
                stdscr.refresh()
                time.sleep(2)

            stdscr.addstr(h-4, 4, "Press any key to return to menu...")
            stdscr.getch()

        elif key == ord('q'):
            break

if __name__ == "__main__":
    curses.wrapper(main)
