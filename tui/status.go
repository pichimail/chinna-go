package tui

import (
	"fmt"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
)

func getMacStatus() string {
	cpuPct, err := cpu.Percent(0, false)
	if err != nil || len(cpuPct) == 0 {
		cpuPct = []float64{0}
	}

	memInfo, err := mem.VirtualMemory()
	memPct := float64(0)
	if err == nil {
		memPct = memInfo.UsedPercent
	}

	hostInfo, err := host.Info()
	hostname := "mac"
	if err == nil && hostInfo.Hostname != "" {
		hostname = hostInfo.Hostname
	}

	bootTime, err := host.BootTime()
	uptime := "unknown"
	if err == nil && bootTime > 0 {
		uptime = time.Since(time.Unix(int64(bootTime), 0)).Truncate(time.Minute).String()
	}

	return fmt.Sprintf("CPU %.0f%% | RAM %.0f%% | %s | up %s", cpuPct[0], memPct, hostname, uptime)
}
