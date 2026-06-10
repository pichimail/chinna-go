#!/usr/bin/env python3
"""
Chinna TUI v2 — Advanced Futuristic Interactive CLI
- Full mouse support (clickable items)
- Colorful motion graphics style views
- Dynamic interactions + copy-paste friendly
- Inspired by modern Grok/Claude code CLIs
"""
import curses
import time
import subprocess
import sys

class ChinnaTUI:
    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.selected = 0
        self.menu_items = [
            ("1", "Doctor — Full system health check"),
            ("2", "Clean — Deep clean with visual progress"),
            ("3", "WhatsApp — Bridge status & control"),
            ("4", "Dashboard — Launch web dashboard"),
            ("5", "AI Chat — Quick AI prompt"),
            ("6", "Music — Control Apple Music"),
            ("7", "Voice Mode — Interactive voice"),
            ("8", "Browser Tools — Extension panel"),
            ("q", "Quit"),
        ]
        self.setup_colors()

    def setup_colors(self):
        curses.start_color()
        curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK)
        curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)
        curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)
        curses.init_pair(4, curses.COLOR_RED, curses.COLOR_BLACK)
        curses.init_pair(5, curses.COLOR_MAGENTA, curses.COLOR_BLACK)
        curses.init_pair(6, curses.COLOR_WHITE, curses.COLOR_BLACK)
        curses.init_pair(7, curses.COLOR_BLUE, curses.COLOR_BLACK)

    def draw_animated_header(self):
        self.stdscr.attron(curses.color_pair(1) | curses.A_BOLD)
        header = " CHINNA v6.6 — Futuristic Interactive CLI "
        self.stdscr.addstr(0, 0, header.center(curses.COLS))
        self.stdscr.attroff(curses.color_pair(1) | curses.A_BOLD)
        
        # Animated underline
        for i in range(curses.COLS):
            self.stdscr.addstr(1, i, "━", curses.color_pair(5))

    def draw_menu(self):
        self.stdscr.clear()
        self.draw_animated_header()

        box_y = 3
        box_h = len(self.menu_items) + 4
        self.draw_box(box_y, 2, box_h, curses.COLS - 4, " MAIN MENU ")

        for idx, (key, label) in enumerate(self.menu_items):
            y = box_y + 2 + idx
            if idx == self.selected:
                self.stdscr.attron(curses.color_pair(2) | curses.A_BOLD)
                self.stdscr.addstr(y, 5, f"▶ {key}. {label}")
                self.stdscr.attroff(curses.color_pair(2) | curses.A_BOLD)
            else:
                self.stdscr.addstr(y, 5, f"  {key}. {label}")

        # Footer with mouse hint
        self.stdscr.addstr(curses.LINES - 3, 2, " Use ↑↓ or Mouse Click • Enter to select • q to quit ")
        self.stdscr.refresh()

    def draw_box(self, y, x, h, w, title=""):
        self.stdscr.attron(curses.color_pair(1))
        self.stdscr.addstr(y, x, "┌" + "─" * (w-2) + "┐")
        for i in range(1, h-1):
            self.stdscr.addstr(y + i, x, "│" + " " * (w-2) + "│")
        self.stdscr.addstr(y + h - 1, x, "└" + "─" * (w-2) + "┘")
        if title:
            self.stdscr.addstr(y, x + 2, f" {title} ")
        self.stdscr.attroff(curses.color_pair(1))

    def handle_mouse(self):
        """Enable mouse support and handle clicks"""
        curses.mousemask(curses.ALL_MOUSE_EVENTS | curses.REPORT_MOUSE_POSITION)
        
        try:
            event = curses.getmouse()
            _, mx, my, _, _ = event
            
            # Check if click is on a menu item
            for idx in range(len(self.menu_items)):
                item_y = 5 + idx
                if my == item_y and 5 <= mx <= curses.COLS - 5:
                    self.selected = idx
                    self.execute_selection()
                    return True
        except:
            pass
        return False

    def execute_selection(self):
        choice = self.menu_items[self.selected][0]
        self.stdscr.clear()
        
        if choice == "q":
            return False
        
        self.stdscr.addstr(4, 4, f"Running: {self.menu_items[self.selected][1]}...")
        self.stdscr.refresh()
        time.sleep(0.5)
        
        try:
            if choice == "1":
                subprocess.run(["chinna", "doctor"])
            elif choice == "2":
                subprocess.run(["chinna", "clean"])
            elif choice == "3":
                subprocess.run(["chinna", "bot"])
            elif choice == "4":
                subprocess.run(["chinna", "dashboard"])
            elif choice == "5":
                curses.echo()
                prompt = self.stdscr.getstr(6, 4, 60).decode()
                curses.noecho()
                subprocess.run(["chinna", "pro", prompt])
            elif choice == "6":
                subprocess.run(["chinna", "music", "playpause"])
            elif choice == "7":
                subprocess.run(["chinna", "listen"])
            elif choice == "8":
                self.stdscr.addstr(6, 4, "Open ~/.chinna/extension in Chrome (Load unpacked)")
                self.stdscr.refresh()
                time.sleep(2)
        except Exception as e:
            self.stdscr.addstr(8, 4, f"Error: {str(e)}")
            self.stdscr.refresh()
            time.sleep(1.5)
        
        self.stdscr.addstr(curses.LINES - 4, 4, "Press any key to return to menu...")
        self.stdscr.getch()
        return True

    def run(self):
        curses.curs_set(0)
        self.stdscr.nodelay(False)
        
        while True:
            self.draw_menu()
            
            key = self.stdscr.getch()
            
            if key == curses.KEY_UP and self.selected > 0:
                self.selected -= 1
            elif key == curses.KEY_DOWN and self.selected < len(self.menu_items) - 1:
                self.selected += 1
            elif key in [curses.KEY_ENTER, 10, 13]:
                if not self.execute_selection():
                    break
            elif key == ord('q'):
                break
            elif key == curses.KEY_MOUSE:
                if not self.handle_mouse():
                    continue


def main(stdscr):
    tui = ChinnaTUI(stdscr)
    tui.run()

if __name__ == "__main__":
    curses.wrapper(main)
