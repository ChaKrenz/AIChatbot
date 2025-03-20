#pragma version 0.4.0
# Simple ERC20-like CookieToken contract

# Token details
name: public(String[64])
symbol: public(String[32])
decimals: public(uint8)
totalSupply: public(uint256)
balances: HashMap[address, uint256]
allowances: HashMap[address, HashMap[address, uint256]]
owner: public(address)

# Events
event Transfer:
    sender: indexed(address)
    receiver: indexed(address)
    value: uint256

event Approval:
    owner: indexed(address)
    spender: indexed(address)
    value: uint256

@deploy
def __init__():
    self.name = "CookieToken"
    self.symbol = "CKT"
    self.decimals = 18
    self.totalSupply = 0
    self.owner = msg.sender

# Mint tokens (only owner)
@external
def mint(receiver: address, amount: uint256):
    assert msg.sender == self.owner, "Only owner can mint"
    assert receiver != empty(address), "Cannot mint to zero address"
    self.balances[receiver] += amount
    self.totalSupply += amount
    log Transfer(empty(address), receiver, amount)

# Transfer tokens
@external
def transfer(receiver: address, amount: uint256) -> bool:
    assert receiver != empty(address), "Cannot transfer to zero address"
    assert self.balances[msg.sender] >= amount, "Insufficient balance"
    self.balances[msg.sender] -= amount
    self.balances[receiver] += amount
    log Transfer(msg.sender, receiver, amount)
    return True

# Approve spender
@external
def approve(spender: address, amount: uint256) -> bool:
    assert spender != empty(address), "Cannot approve zero address"
    self.allowances[msg.sender][spender] = amount
    log Approval(msg.sender, spender, amount)
    return True

# TransferFrom (allowance-based transfer)
@external
def transferFrom(sender: address, receiver: address, amount: uint256) -> bool:
    assert receiver != empty(address), "Cannot transfer to zero address"
    assert self.balances[sender] >= amount, "Insufficient balance"
    assert self.allowances[sender][msg.sender] >= amount, "Insufficient allowance"
    self.balances[sender] -= amount
    self.balances[receiver] += amount
    self.allowances[sender][msg.sender] -= amount
    log Transfer(sender, receiver, amount)
    return True

# Check balance
@view
@external
def balanceOf(account: address) -> uint256:
    return self.balances[account]

# Check allowance
@view
@external
def allowance(owner: address, spender: address) -> uint256:
    return self.allowances[owner][spender]

# Change owner
@external
def changeOwner(newOwner: address):
    assert msg.sender == self.owner, "Only owner can change ownership"
    assert newOwner != empty(address), "New owner cannot be zero address"
    self.owner = newOwner