# ~/.bashrc: executed by bash(1) for non-login shells.
# see /usr/share/doc/bash/examples/startup-files (in the package bash-doc)
# for examples

source $HOME/.cargo/env

export ALTERNATE_EDITOR="gedit"
export EDITOR="emacs -nw"


# \emacs --daemon

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# don't put duplicate lines or lines starting with space in the history.
# See bash(1) for more options
HISTCONTROL=ignoreboth

# append to the history file, don't overwrite it
shopt -s histappend

# for setting history length see HISTSIZE and HISTFILESIZE in bash(1)
HISTSIZE=1000
HISTFILESIZE=2000

# check the window size after each command and, if necessary,
# update the values of LINES and COLUMNS.
shopt -s checkwinsize

# If set, the pattern "**" used in a pathname expansion context will
# match all files and zero or more directories and subdirectories.
#shopt -s globstar

# make less more friendly for non-text input files, see lesspipe(1)
#[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

# set variable identifying the chroot you work in (used in the prompt below)
if [ -z "${debian_chroot:-}" ] && [ -r /etc/debian_chroot ]; then
    debian_chroot=$(cat /etc/debian_chroot)
fi

# set a fancy prompt (non-color, unless we know we "want" color)
case "$TERM" in
    xterm-color) color_prompt=yes;;
esac

# uncomment for a colored prompt, if the terminal has the capability; turned
# off by default to not distract the user: the focus in a terminal window
# should be on the output of commands, not on the prompt
#force_color_prompt=yes

if [ -n "$force_color_prompt" ]; then
    if [ -x /usr/bin/tput ] && tput setaf 1 >&/dev/null; then
	# We have color support; assume it's compliant with Ecma-48
	# (ISO/IEC-6429). (Lack of such support is extremely rare, and such
	# a case would tend to support setf rather than setaf.)
	color_prompt=yes
    else
	color_prompt=
    fi
fi

if [ "$color_prompt" = yes ]; then
    PS1='${debian_chroot:+($debian_chroot)}\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '
else
    PS1='${debian_chroot:+($debian_chroot)}\u@\h:\w\$ '
fi
unset color_prompt force_color_prompt

# If this is an xterm set the title to user@host:dir
case "$TERM" in
xterm*|rxvt*)
    PS1="\[\e]0;${debian_chroot:+($debian_chroot)}\u@\h: \w\a\]$PS1"
    ;;
*)
    ;;
esac

# enable color support of ls and also add handy aliases
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    alias dir='dir --color=auto'
    alias vdir='vdir --color=auto'

    alias grep='grep --color=auto'
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
fi

# colored GCC warnings and errors
export GCC_COLORS='error=01;31:warning=01;35:note=01;36:caret=01;32:locus=01:quote=01'

# some more ls aliases
alias ll='ls -l'
alias la='ls -A'
alias lla='ls -la'
alias llA='ls -lA'
alias l='ls -CF'
alias emacs='XLIB_SKIP_ARGB_VISUALS=1 emacs'
alias sudo='sudo '
alias pp='rm -rf *~ \#*\#'
alias pyg='pygmentize'
alias norme='/opt/norme.py -nocheat'
alias xtrace='/home/boehm-s/install/xtrace.sh'


alias gst='git status'
alias gc='git commit'
alias gp='git push'
alias sbrc='source /home/boehm-s/.bashrc'
alias grep='grep --color=auto'

#source ~/.bash-powerline.sh

function mkcdir() {
    opt=()
    dir=()
    i=0
    for var in "$@"
    do
	if [[ $var =~ ^- ]]
	then
	    opt[i]=("$var")
	else
	    dir+=("$var")
	fi
	i=$((i+1))
    done
    mkdir $opt $dir
    cd ${dir[-1]}
}

function join_by() { local IFS=$1; shift; echo "$*"; }


# Alias definitions.
# You may want to put all your additions into a separate file like
# ~/.bash_aliases, instead of adding them here directly.
# See /usr/share/doc/bash-doc/examples in the bash-doc package.

if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi

# enable programmable completion features (you don't need to enable
# this, if it's already enabled in /etc/bash.bashrc and /etc/profile
# sources /etc/bash.bashrc).
if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

export EDITOR="/usr/bin/emacs -nw"

PATH=/home/boehm-s/Public/emacs/src:/home/boehm-s/Public/emacs/src:/home/boehm-s/.cargo/bin:/home/boehm-s/.cargo/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion


# Custom commands



function  pless() {
    pygmentize $@ | less -R
}

function fpkg() {
    options=`getopt -o n --long names -- "$@"`

    [ $? -eq 0 ] || {
    echo "Incorrect options provided"
    exit 1
    }

    pkglist=$(sudo dpkg -l | grep -i $1)

    eval set -- "$options"

    while true; do
	case "$1" in
	    -n|--names)
		echo "$pkglist" | head -n10 | awk '{print $2}'
		;;
	    --)
		shift
		break
		;;
	esac
	shift
    done

}
